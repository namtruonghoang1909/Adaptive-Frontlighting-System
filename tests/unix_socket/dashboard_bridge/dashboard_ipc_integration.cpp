#include "afs_bridge/dashboard_ipc.hpp"
#include "afs_bridge/runner_ipc.hpp"

#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>

namespace {
using namespace std::chrono_literals;

void require(bool condition, const std::string& message) {
    if (!condition) throw std::runtime_error(message);
}

void wait_for(const std::function<bool()>& predicate, const std::string& message) {
    const auto deadline = std::chrono::steady_clock::now() + 2s;
    while (std::chrono::steady_clock::now() < deadline) {
        if (predicate()) return;
        std::this_thread::sleep_for(5ms);
    }
    throw std::runtime_error("timed out waiting for " + message);
}

class TemporaryDirectory {
public:
    TemporaryDirectory() {
        char pattern[] = "/tmp/afs-dashboard-ipc-XXXXXX";
        const auto* path = ::mkdtemp(pattern);
        if (!path) throw std::runtime_error("mkdtemp failed");
        path_ = path;
    }
    ~TemporaryDirectory() { ::rmdir(path_.c_str()); }
    const std::string& path() const { return path_; }
private:
    std::string path_;
};

int connect_dashboard(const std::string& path) {
    const int fd = ::socket(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0);
    if (fd < 0) throw std::runtime_error("Dashboard socket creation failed");
    sockaddr_un address{};
    address.sun_family = AF_UNIX;
    std::strncpy(address.sun_path, path.c_str(), sizeof(address.sun_path) - 1);
    if (::connect(fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0) {
        ::close(fd);
        throw std::runtime_error("Dashboard connect failed");
    }
    return fd;
}

std::string exchange(int fd, const std::string& packet) {
    const auto sent = ::send(fd, packet.data(), packet.size(), MSG_NOSIGNAL);
    if (sent < 0 || static_cast<std::size_t>(sent) != packet.size())
        throw std::runtime_error("Dashboard packet send failed");
    char response[4096];
    const auto received = ::recv(fd, response, sizeof(response), 0);
    if (received <= 0) throw std::runtime_error("Dashboard response receive failed");
    return {response, static_cast<std::size_t>(received)};
}

void run_integration() {
    TemporaryDirectory directory;
    const auto runner_path = directory.path() + "/runner.sock";
    const auto dashboard_path = directory.path() + "/dashboard.sock";
    afs_bridge::RunnerIpcServer runner(runner_path);
    afs_bridge::DashboardIpcServer dashboard(dashboard_path, runner, true);
    std::exception_ptr server_error;
    std::thread server([&] {
        try { dashboard.run(); }
        catch (...) { server_error = std::current_exception(); }
    });

    int client = -1;
    try {
        wait_for([&] {
            struct stat status{};
            return ::lstat(dashboard_path.c_str(), &status) == 0 && S_ISSOCK(status.st_mode);
        }, "Dashboard IPC socket");
        client = connect_dashboard(dashboard_path);
        const auto hello = exchange(client,
            R"({"protocol_version":1,"type":"hello","role":"dashboard"})");
        require(hello.find("\"type\":\"hello_ack\"") != std::string::npos,
                "Dashboard hello should be acknowledged");

        const auto clear_result = exchange(client,
            R"({"protocol_version":1,"type":"clear_fault","request_id":"clear-1"})");
        require(clear_result.find("\"accepted\":true") != std::string::npos &&
                    clear_result.find("queued_for_can") != std::string::npos,
                "CAN-enabled bridge should queue clear-fault");
        auto command = dashboard.command_snapshot();
        require(!command.present && command.valid && command.clear_fault_pending,
                "clear-fault alone should create one valid command pulse");
        dashboard.acknowledge_clear_fault(command.clear_fault_generation);
        command = dashboard.command_snapshot();
        require(!command.valid && !command.clear_fault_pending,
                "successful pulse acknowledgement should clear command validity without a mode request");

        const auto command_result = exchange(client,
            R"({"protocol_version":1,"type":"command","request_id":"mode-1","power_on":true,"mode":"high_beam_dimming"})");
        require(command_result.find("\"accepted\":true") != std::string::npos,
                "valid headlight command should be stored");
        command = dashboard.command_snapshot();
        require(command.present && command.valid && command.power_on && command.mode_code == 3,
                "accepted command should be valid while Dashboard is connected");

        afs_bridge::AfsStatus status{};
        status.alive_counter = 7;
        status.required_inputs_valid = true;
        status.executed_mode = 5;
        status.health_state = 1;
        status.left_servo_feedback_deg = -1.5;
        status.right_servo_feedback_deg = 0.5;
        status.applied_dim_sector_mask = 0x18;
        status.received_monotonic_ns = static_cast<std::uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(
                std::chrono::steady_clock::now().time_since_epoch()).count());
        dashboard.retain_ecu_status(status);
        const auto reply = exchange(client,
            R"({"protocol_version":1,"type":"get_status"})");
        for (const auto& field : {
                 "\"valid\":true", "\"can\":{\"enabled\":true}",
                 "\"available\":true", "\"executed_mode\":5",
                 "\"health_state\":1", "\"left_servo_feedback_deg\":-1.5",
                 "\"right_servo_feedback_deg\":0.5", "\"applied_dim_sector_mask\":24"}) {
            require(reply.find(field) != std::string::npos,
                    std::string("Dashboard status should include ") + field);
        }

        ::close(client);
        client = -1;
        wait_for([&] { return !dashboard.command_snapshot().valid; },
                 "CommandValid to clear on Dashboard disconnect");
    } catch (...) {
        if (client >= 0) ::close(client);
        dashboard.stop();
        if (server.joinable()) server.join();
        if (server_error) std::rethrow_exception(server_error);
        throw;
    }

    dashboard.stop();
    server.join();
    if (server_error) std::rethrow_exception(server_error);
}

}  // namespace

int main() {
    try {
        run_integration();
        std::cout << "Dashboard IPC integration checks passed.\n";
    } catch (const std::exception& error) {
        std::cerr << "Dashboard IPC integration check failed: " << error.what() << '\n';
        return 1;
    }
    return 0;
}
