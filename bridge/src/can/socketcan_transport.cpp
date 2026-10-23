#include "afs_bridge/socketcan_transport.hpp"
#include "afs_bridge/socketcan_frame.hpp"

#include "afs.h"

#include <algorithm>
#include <array>
#include <cerrno>
#include <chrono>
#include <climits>
#include <cstdint>
#include <cstring>
#include <linux/can/raw.h>
#include <net/if.h>
#include <net/if_arp.h>
#include <poll.h>
#include <stdexcept>
#include <string>
#include <system_error>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <utility>
#include <unistd.h>

namespace afs_bridge {
namespace {

using Clock = std::chrono::steady_clock;

[[noreturn]] void throw_errno(const std::string& operation) {
    throw std::system_error(errno, std::generic_category(), operation);
}

int remaining_timeout_ms(Clock::time_point deadline) {
    const auto now = Clock::now();
    if (now >= deadline) return 0;
    const auto remaining = deadline - now;
    auto timeout = std::chrono::duration_cast<std::chrono::milliseconds>(remaining);
    if (timeout.count() == 0) timeout = std::chrono::milliseconds(1);
    return static_cast<int>(std::min<std::int64_t>(timeout.count(), INT_MAX));
}

bool wait_for(int fd, short requested_events, Clock::time_point deadline) {
    while (true) {
        pollfd descriptor{fd, requested_events, 0};
        const int result = ::poll(&descriptor, 1, remaining_timeout_ms(deadline));
        if (result == 0) return false;
        if (result < 0) {
            if (errno == EINTR) continue;
            throw_errno("SocketCAN poll");
        }
        if (descriptor.revents & (POLLERR | POLLHUP | POLLNVAL)) {
            int socket_error = 0;
            socklen_t size = sizeof(socket_error);
            if (::getsockopt(fd, SOL_SOCKET, SO_ERROR, &socket_error, &size) == 0 &&
                socket_error != 0) {
                throw std::system_error(socket_error, std::generic_category(),
                                        "SocketCAN poll reported an error");
            }
            throw std::runtime_error("SocketCAN poll reported a closed or invalid socket");
        }
        if (descriptor.revents & requested_events) return true;
    }
}

unsigned int inspect_interface(const std::string& name) {
    if (name.empty() || name.size() >= IFNAMSIZ) {
        throw std::invalid_argument("CAN interface name is empty or too long");
    }

    const unsigned int index = ::if_nametoindex(name.c_str());
    if (index == 0) throw_errno("CAN interface does not exist: " + name);

    const int control_fd = ::socket(AF_INET, SOCK_DGRAM | SOCK_CLOEXEC, 0);
    if (control_fd < 0) throw_errno("cannot inspect CAN interface");

    ifreq request{};
    std::strncpy(request.ifr_name, name.c_str(), sizeof(request.ifr_name) - 1);
    const int flags_result = ::ioctl(control_fd, SIOCGIFFLAGS, &request);
    const int flags_error = errno;
    if (flags_result != 0) {
        ::close(control_fd);
        errno = flags_error;
        throw_errno("cannot read CAN interface flags: " + name);
    }
    if (!(request.ifr_flags & IFF_UP)) {
        ::close(control_fd);
        throw std::runtime_error("CAN interface is down: " + name);
    }

    ifreq hardware{};
    std::strncpy(hardware.ifr_name, name.c_str(), sizeof(hardware.ifr_name) - 1);
    const int hardware_result = ::ioctl(control_fd, SIOCGIFHWADDR, &hardware);
    const int hardware_error = errno;
    ::close(control_fd);
    if (hardware_result != 0) {
        errno = hardware_error;
        throw_errno("cannot inspect CAN interface type: " + name);
    }
    if (hardware.ifr_hwaddr.sa_family != ARPHRD_CAN) {
        throw std::runtime_error("interface is not a CAN device: " + name);
    }
    return index;
}

}  // namespace

SocketCanTransport::SocketCanTransport(std::string interface_name)
    : interface_name_(std::move(interface_name)) {
    const unsigned int interface_index = inspect_interface(interface_name_);
    const int fd = ::socket(PF_CAN, SOCK_RAW | SOCK_CLOEXEC | SOCK_NONBLOCK, CAN_RAW);
    if (fd < 0) throw_errno("SocketCAN socket creation failed");

    try {
        can_filter filter{};
        filter.can_id = AFS_AFS_STATUS_FRAME_ID;
        filter.can_mask = CAN_SFF_MASK | CAN_EFF_FLAG | CAN_RTR_FLAG;
        if (::setsockopt(fd, SOL_CAN_RAW, CAN_RAW_FILTER, &filter,
                         sizeof(filter)) != 0) {
            throw_errno("SocketCAN status filter setup failed");
        }

        sockaddr_can address{};
        address.can_family = AF_CAN;
        address.can_ifindex = static_cast<int>(interface_index);
        if (::bind(fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0) {
            throw_errno("SocketCAN bind failed for " + interface_name_);
        }
    } catch (...) {
        ::close(fd);
        throw;
    }

    socket_fd_ = fd;
}

SocketCanTransport::~SocketCanTransport() {
    if (socket_fd_ >= 0) ::close(socket_fd_);
}

void SocketCanTransport::send(const CanFrame& frame,
                              std::chrono::milliseconds timeout) const {
    if (timeout.count() < 0) throw std::invalid_argument("SocketCAN send timeout is negative");

    const auto native_frame = to_native_can_frame(frame);
    const auto deadline = Clock::now() + timeout;

    while (true) {
        if (!wait_for(socket_fd_, POLLOUT, deadline)) {
            throw std::runtime_error("SocketCAN transmit deadline expired on " + interface_name_);
        }
        const auto written = ::write(socket_fd_, &native_frame, sizeof(native_frame));
        if (written == static_cast<ssize_t>(sizeof(native_frame))) return;
        if (written >= 0) throw std::runtime_error("SocketCAN wrote a partial CAN frame");
        if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) continue;
        throw_errno("SocketCAN transmit failed on " + interface_name_);
    }
}

std::optional<CanFrame> SocketCanTransport::receive(
    std::chrono::milliseconds timeout) const {
    if (timeout.count() < 0) throw std::invalid_argument("SocketCAN receive timeout is negative");
    const auto deadline = Clock::now() + timeout;

    while (true) {
        if (!wait_for(socket_fd_, POLLIN, deadline)) return std::nullopt;

        can_frame native_frame{};
        const auto received = ::read(socket_fd_, &native_frame, sizeof(native_frame));
        if (received < 0) {
            if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) continue;
            throw_errno("SocketCAN receive failed on " + interface_name_);
        }
        if (received != static_cast<ssize_t>(sizeof(native_frame))) {
            throw std::runtime_error("SocketCAN returned a truncated CAN frame");
        }
        auto frame = from_native_can_frame(native_frame);
        if (!frame) continue;
        return frame;
    }
}

std::string SocketCanTransport::interface_name() const { return interface_name_; }

}  // namespace afs_bridge
