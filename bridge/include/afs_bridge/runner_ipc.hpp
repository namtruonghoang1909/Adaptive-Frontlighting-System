#pragma once

#include <cstdint>
#include <atomic>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

namespace afs_bridge {

struct RunnerObject {
    std::string id;
    std::string type;
    double x_forward_m{};
    double y_left_m{};
    std::optional<double> length_m;
    std::optional<double> width_m;
    std::optional<double> relative_heading_rad;
};

struct RunnerScene {
    std::string session;
    std::uint64_t sequence{};
    std::uint64_t captured_monotonic_ns{};
    std::optional<std::int64_t> seed;
    std::optional<std::int64_t> episode_step;
    std::optional<double> sim_time_s;
    bool ego_valid{};
    bool objects_valid{};
    bool objects_degraded{};
    bool objects_truncated{};
    bool ipc_faulted{true};
    bool has_steering{};
    bool has_speed{};
    double steering_deg{};
    std::optional<double> max_steering_deg;
    double longitudinal_speed_mps{};
    std::string source;
    std::vector<RunnerObject> objects;
};

class RunnerIpcServer {
public:
    explicit RunnerIpcServer(std::string socket_path, bool log_scenes = true);
    ~RunnerIpcServer();
    RunnerIpcServer(const RunnerIpcServer&) = delete;
    RunnerIpcServer& operator=(const RunnerIpcServer&) = delete;

    // Blocks until stop() is called. New valid scenes replace the current scene.
    void run();
    void stop();
    bool has_scene() const;
    RunnerScene latest_scene() const;
    std::string socket_path() const;

private:
    std::string path_;
    bool log_scenes_;
    std::atomic_int listen_fd_{-1};
    mutable std::mutex state_lock_;
    RunnerScene scene_;
    bool has_scene_{false};
    std::atomic_bool stopping_{false};
};

}  // namespace afs_bridge
