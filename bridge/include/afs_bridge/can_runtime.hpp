#pragma once

#include "afs_bridge/afs_status.hpp"
#include "afs_bridge/can_encoder.hpp"
#include "afs_bridge/can_frame_encoder.hpp"
#include "afs_bridge/dashboard_ipc.hpp"
#include "afs_bridge/runner_ipc.hpp"
#include "afs_bridge/socketcan_transport.hpp"

#include <atomic>
#include <mutex>
#include <optional>
#include <string>

namespace afs_bridge {

// Publishes speed/steering every 20 ms, object grid every 100 ms, and the
// current Dashboard command every 50 ms while receiving ECU status.
class CanRuntime {
public:
    CanRuntime(std::string interface_name, const RunnerIpcServer& runner,
               DashboardIpcServer& dashboard);
    CanRuntime(const CanRuntime&) = delete;
    CanRuntime& operator=(const CanRuntime&) = delete;

    void run();
    void stop();
    std::optional<AfsStatus> latest_status() const;
    std::string interface_name() const;

private:
    void report_io_error(const std::string& operation, const std::string& message);
    void report_status_rejection(const std::string& message);

    const RunnerIpcServer& runner_;
    DashboardIpcServer& dashboard_;
    SocketCanTransport transport_;
    CanEncoder can_encoder_;
    CanFrameEncoder frame_encoder_;
    AfsStatusDecoder status_decoder_;
    std::atomic_bool stopping_{false};
    mutable std::mutex status_lock_;
    std::optional<AfsStatus> latest_status_;
    std::uint8_t dashboard_counter_{};
};

}  // namespace afs_bridge
