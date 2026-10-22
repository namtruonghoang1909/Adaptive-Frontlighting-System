#pragma once

#include "afs_bridge/runner_ipc.hpp"

#include <atomic>
#include <string>

namespace afs_bridge {

class DashboardIpcServer {
public:
    DashboardIpcServer(std::string socket_path, const RunnerIpcServer& runner);
    ~DashboardIpcServer();
    DashboardIpcServer(const DashboardIpcServer&) = delete;
    DashboardIpcServer& operator=(const DashboardIpcServer&) = delete;

    void run();
    void stop();
    std::string socket_path() const;

private:
    std::string path_;
    const RunnerIpcServer& runner_;
    std::atomic_int listen_fd_{-1};
    std::atomic_int client_fd_{-1};
    std::atomic_bool stopping_{false};
    bool has_request_{false};
    std::string request_id_;
    bool power_on_{false};
    std::string mode_{"low_beam_no_swivel"};
};

}  // namespace afs_bridge
