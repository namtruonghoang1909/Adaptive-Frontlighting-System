#include "afs_bridge/runner_ipc.hpp"

#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <atomic>
#include <cerrno>
#include <exception>
#include <iostream>
#include <memory>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <sys/time.h>
#include <unistd.h>
#include <vector>

namespace {
using namespace std::chrono_literals;

constexpr const char* kSession = "11111111-2222-4333-8444-555555555555";
constexpr const char* kSecondSession = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

void require(bool condition, const std::string& message) {
    if (!condition) throw std::runtime_error(message);
}

template <typename Predicate>
void wait_for(Predicate predicate, const std::string& description) {
    const auto deadline = std::chrono::steady_clock::now() + 3s;
    while (std::chrono::steady_clock::now() < deadline) {
        if (predicate()) return;
        std::this_thread::sleep_for(10ms);
    }
    throw std::runtime_error("timed out waiting for " + description);
}

std::uint64_t monotonic_ns() {
    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    return static_cast<std::uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(now).count());
}

class ReceiverFixture {
public:
    ReceiverFixture() {
        char path_template[] = "/tmp/afs-runner-ipc-test-XXXXXX";
        char* created = ::mkdtemp(path_template);
        if (created == nullptr) throw std::runtime_error("mkdtemp failed");
        directory_ = created;
        socket_path_ = directory_ + "/runner.sock";
        server_ = std::make_unique<afs_bridge::RunnerIpcServer>(socket_path_);
        worker_ = std::thread([this] {
            try {
                server_->run();
            } catch (...) {
                std::lock_guard<std::mutex> lock(error_mutex_);
                server_error_ = std::current_exception();
            }
            finished_.store(true);
        });

        try {
            wait_for([this] {
                if (finished_.load()) {
                    rethrow_server_error();
                    throw std::runtime_error("receiver exited before listening");
                }
                struct stat info{};
                return ::lstat(socket_path_.c_str(), &info) == 0 &&
                       S_ISSOCK(info.st_mode) && (info.st_mode & 0777) == 0600;
            }, "the receiver socket with mode 0600");
            rethrow_server_error();
        } catch (...) {
            server_->stop();
            if (worker_.joinable()) worker_.join();
            ::unlink(socket_path_.c_str());
            ::rmdir(directory_.c_str());
            throw;
        }
    }

    ~ReceiverFixture() {
        server_->stop();
        if (worker_.joinable()) worker_.join();
        ::unlink(socket_path_.c_str());
        ::rmdir(directory_.c_str());
    }

    ReceiverFixture(const ReceiverFixture&) = delete;
    ReceiverFixture& operator=(const ReceiverFixture&) = delete;

    const std::string& socket_path() const { return socket_path_; }
    afs_bridge::RunnerIpcServer& server() { return *server_; }

private:
    void rethrow_server_error() {
        std::lock_guard<std::mutex> lock(error_mutex_);
        if (server_error_) std::rethrow_exception(server_error_);
    }

    std::string directory_;
    std::string socket_path_;
    std::unique_ptr<afs_bridge::RunnerIpcServer> server_;
    std::thread worker_;
    std::atomic_bool finished_{false};
    std::mutex error_mutex_;
    std::exception_ptr server_error_;
};

int connect_publisher(const std::string& path) {
    const int fd = ::socket(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0);
    if (fd < 0) throw std::runtime_error("publisher socket creation failed");

    timeval timeout{2, 0};
    ::setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    sockaddr_un address{};
    address.sun_family = AF_UNIX;
    if (path.size() >= sizeof(address.sun_path)) {
        ::close(fd);
        throw std::runtime_error("test socket path is too long");
    }
    std::memcpy(address.sun_path, path.c_str(), path.size() + 1);
    if (::connect(fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0) {
        ::close(fd);
        throw std::runtime_error("publisher connect failed");
    }
    return fd;
}

void send_packet(int fd, const std::string& packet) {
    const auto sent = ::send(fd, packet.data(), packet.size(), MSG_NOSIGNAL);
    if (sent < 0 || static_cast<std::size_t>(sent) != packet.size()) {
        throw std::runtime_error("publisher packet send failed");
    }
}

std::string receive_packet(int fd) {
    std::vector<char> buffer(64 * 1024 + 1);
    const auto received = ::recv(fd, buffer.data(), buffer.size(), 0);
    if (received == 0) throw std::runtime_error("receiver closed publisher before replying");
    if (received < 0) throw std::runtime_error("publisher reply receive failed: " + std::string(std::strerror(errno)));
    return std::string(buffer.data(), static_cast<std::size_t>(received));
}

std::string hello_packet(const std::string& session) {
    return "{\"protocol_version\":1,\"type\":\"hello\",\"role\":\"runner\",\"runner_session\":\"" +
           session + "\"}";
}

void expect_hello_ack(int fd, const std::string& session) {
    send_packet(fd, hello_packet(session));
    const std::string reply = receive_packet(fd);
    require(reply.find("\"type\":\"hello_ack\"") != std::string::npos,
            "receiver did not acknowledge a valid runner hello");
    require(reply.find(session) != std::string::npos,
            "hello acknowledgement did not echo the runner session");
}

std::string scene_packet(const std::string& session, std::uint64_t sequence,
                         std::uint64_t captured_ns, double steering = 2.5,
                         double speed = 8.75, std::size_t object_count = 1) {
    std::ostringstream packet;
    packet.precision(17);
    const bool truncated = object_count > 128;
    packet << "{\"protocol_version\":1,\"type\":\"scene\",\"runner_session\":\""
           << session << "\",\"sequence\":" << sequence
           << ",\"captured_monotonic_ns\":" << captured_ns
           << ",\"sample\":{\"source\":\"metadrive\",\"seed\":21,\"episode_step\":7,\"sim_time_s\":0.42}"
           << ",\"quality\":{\"ego_valid\":true,\"objects_valid\":true,\"objects_degraded\":"
           << (truncated ? "true" : "false")
           << ",\"objects_truncated\":" << (truncated ? "true" : "false") << "}"
           << ",\"ego\":{\"steering_deg\":" << steering
           << ",\"longitudinal_speed_mps\":" << speed << "},\"objects\":[";
    for (std::size_t index = 0; index < object_count; ++index) {
        if (index != 0) packet << ',';
        packet << "{\"id\":\"vehicle-" << index
               << "\",\"type\":\"VEHICLE\",\"x_forward_m\":12.0"
               << ",\"y_left_m\":-1.5,\"length_m\":4.5,\"width_m\":1.8"
               << ",\"relative_heading_rad\":0.1}";
    }
    packet << "]}";
    return packet.str();
}

void wait_for_sequence(afs_bridge::RunnerIpcServer& server, std::uint64_t sequence) {
    wait_for([&] {
        return server.has_scene() && server.latest_scene().sequence == sequence;
    }, "scene sequence " + std::to_string(sequence));
}

void assert_current_scene(afs_bridge::RunnerIpcServer& server, std::uint64_t sequence,
                          double expected_speed) {
    std::this_thread::sleep_for(100ms);
    require(server.has_scene(), "receiver unexpectedly cleared the accepted scene");
    const auto scene = server.latest_scene();
    require(scene.sequence == sequence, "rejected packet changed the latest accepted sequence");
    require(scene.has_speed && std::abs(scene.longitudinal_speed_mps - expected_speed) < 1e-9,
            "rejected packet changed the latest accepted scene values");
}

void run_integration_scenario() {
    ReceiverFixture receiver;
    struct stat socket_info{};
    require(::stat(receiver.socket_path().c_str(), &socket_info) == 0,
            "receiver socket disappeared after startup");
    require((socket_info.st_mode & 0777) == 0600, "receiver socket mode is not 0600");

    const int publisher = connect_publisher(receiver.socket_path());
    expect_hello_ack(publisher, kSession);
    require(!receiver.server().has_scene(), "receiver exposed a scene before receiving one");

    send_packet(publisher, scene_packet(kSession, 1, monotonic_ns()));
    wait_for_sequence(receiver.server(), 1);
    auto scene = receiver.server().latest_scene();
    require(scene.session == kSession, "stored scene has the wrong session");
    require(scene.source == "metadrive" && scene.seed == 21 && scene.episode_step == 7,
            "stored sample metadata did not match the delivered scene");
    require(scene.ego_valid && scene.objects_valid && scene.has_steering && scene.has_speed,
            "stored scene validity or ego fields are incorrect");
    require(std::abs(scene.steering_deg - 2.5) < 1e-9 &&
                std::abs(scene.longitudinal_speed_mps - 8.75) < 1e-9,
            "stored ego values did not match the delivered scene");
    require(scene.objects.size() == 1 && scene.objects[0].id == "vehicle-0" &&
                std::abs(scene.objects[0].x_forward_m - 12.0) < 1e-9,
            "stored surrounding object did not match the delivered scene");

    const int competing_publisher = connect_publisher(receiver.socket_path());
    send_packet(competing_publisher, hello_packet(kSecondSession));
    const std::string competing_reply = receive_packet(competing_publisher);
    require(competing_reply.find("\"type\":\"hello_reject\"") != std::string::npos &&
                competing_reply.find("publisher_active") != std::string::npos,
            "receiver did not reject a second active publisher");
    ::close(competing_publisher);

    send_packet(publisher, "{malformed-json");
    assert_current_scene(receiver.server(), 1, 8.75);
    send_packet(publisher, scene_packet(kSession, 1, monotonic_ns(), 40.0, 99.0));
    assert_current_scene(receiver.server(), 1, 8.75);
    send_packet(publisher, scene_packet(kSecondSession, 2, monotonic_ns(), 2.5, 99.0));
    assert_current_scene(receiver.server(), 1, 8.75);
    send_packet(publisher, scene_packet(kSession, 2, monotonic_ns() - 1000000000ULL));
    assert_current_scene(receiver.server(), 1, 8.75);

    send_packet(publisher, scene_packet(kSession, 2, monotonic_ns(), 2.5, 12.25, 128));
    wait_for_sequence(receiver.server(), 2);
    scene = receiver.server().latest_scene();
    require(std::abs(scene.longitudinal_speed_mps - 12.25) < 1e-9 && scene.objects.size() == 128,
            "receiver did not replace the prior scene with the newer scene");

    send_packet(publisher, std::string(64 * 1024 + 1, 'x'));
    assert_current_scene(receiver.server(), 2, 12.25);
    send_packet(publisher, scene_packet(kSession, 3, monotonic_ns(), 91.0, 12.25));
    assert_current_scene(receiver.server(), 2, 12.25);
    send_packet(publisher, scene_packet(kSession, 3, monotonic_ns(), 2.5, 12.25, 129));
    assert_current_scene(receiver.server(), 2, 12.25);

    ::close(publisher);
    wait_for([&] { return !receiver.server().has_scene(); }, "disconnect to clear scene availability");

    const int invalid_publisher = connect_publisher(receiver.socket_path());
    send_packet(invalid_publisher, "{}");
    const std::string invalid_reply = receive_packet(invalid_publisher);
    require(invalid_reply.find("\"type\":\"hello_reject\"") != std::string::npos,
            "receiver did not reject a malformed hello");
    ::close(invalid_publisher);

    const int reconnecting_publisher = connect_publisher(receiver.socket_path());
    expect_hello_ack(reconnecting_publisher, kSecondSession);
    send_packet(reconnecting_publisher,
                scene_packet(kSecondSession, 1, monotonic_ns(), 0.0, 3.0, 0));
    wait_for_sequence(receiver.server(), 1);
    require(receiver.server().latest_scene().session == kSecondSession &&
                receiver.server().latest_scene().objects.empty(),
            "new publisher session did not replace prior state");
    ::close(reconnecting_publisher);
}
}  // namespace

int main() {
    try {
        run_integration_scenario();
        std::cout << "runner IPC integration checks passed\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "runner IPC integration check failed: " << error.what() << '\n';
        return 1;
    }
}
