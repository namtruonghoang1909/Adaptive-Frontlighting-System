#pragma once

#include "afs_bridge/afs_status.hpp"
#include "afs_bridge/runner_ipc.hpp"

#include <atomic>
#include <cstdint>
#include <mutex>
#include <optional>
#include <string>

namespace afs_bridge {

struct DashboardCommandSnapshot {
    bool present{};
    bool valid{};
    std::string request_id;
    bool power_on{};
    std::string mode{"low_beam_no_swivel"};
    std::uint8_t mode_code{};
    bool clear_fault_pending{};
    std::uint64_t clear_fault_generation{};
};

class DashboardIpcServer {
public:
    DashboardIpcServer(std::string socket_path, const RunnerIpcServer& runner,
                       bool can_enabled = false);
    ~DashboardIpcServer();
    DashboardIpcServer(const DashboardIpcServer&) = delete;
    DashboardIpcServer& operator=(const DashboardIpcServer&) = delete;

    void run();
    void stop();
    std::string socket_path() const;
    bool can_enabled() const;
    DashboardCommandSnapshot command_snapshot() const;
    std::optional<AfsStatus> latest_ecu_status() const;
    void retain_ecu_status(const AfsStatus& status);
    void acknowledge_clear_fault(std::uint64_t generation);

private:
    std::string path_;
    const RunnerIpcServer& runner_;
    std::atomic_int listen_fd_{-1};
    std::atomic_int client_fd_{-1};
    std::atomic_bool stopping_{false};
    const bool can_enabled_;
    mutable std::mutex state_lock_;
    bool dashboard_connected_{false};
    bool has_request_{false};
    std::string request_id_;
    bool power_on_{false};
    std::string mode_{"low_beam_no_swivel"};
    std::uint8_t mode_code_{};
    bool clear_fault_pending_{false};
    std::uint64_t clear_fault_generation_{};
    std::optional<AfsStatus> latest_ecu_status_;
};

}  // namespace afs_bridge
