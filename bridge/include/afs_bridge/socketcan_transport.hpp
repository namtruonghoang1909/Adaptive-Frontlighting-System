#pragma once

#include "afs_bridge/can_frame_encoder.hpp"

#include <chrono>
#include <optional>
#include <string>

namespace afs_bridge {

// Linux Classical CAN transport bound to one configured interface. It only
// moves standard CAN frames; DBC interpretation stays in the CAN layer.
class SocketCanTransport {
public:
    explicit SocketCanTransport(std::string interface_name);
    ~SocketCanTransport();

    SocketCanTransport(const SocketCanTransport&) = delete;
    SocketCanTransport& operator=(const SocketCanTransport&) = delete;

    void send(const CanFrame& frame,
              std::chrono::milliseconds timeout = std::chrono::milliseconds(2)) const;
    std::optional<CanFrame> receive(std::chrono::milliseconds timeout) const;

    std::string interface_name() const;

private:
    std::string interface_name_;
    int socket_fd_{-1};
};

}  // namespace afs_bridge
