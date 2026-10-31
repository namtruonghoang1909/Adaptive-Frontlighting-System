#pragma once

#include "afs_bridge/runner_ipc.hpp"

#include <array>
#include <cstdint>
#include <optional>

namespace afs_bridge {

inline constexpr std::size_t kVehicleSectorCount = 10;

// Validated, quantized physical signal values before the DBC-generated C
// codec converts them to raw signal values and packs the payload bits.
struct SteeringCanSignals {
    std::uint8_t alive_counter{};
    bool valid{};
    bool saturated{};
    double angle_deg{};
};

struct SpeedCanSignals {
    std::uint8_t alive_counter{};
    bool valid{};
    bool saturated{};
    double longitudinal_speed_mps{};
};

struct VehicleSectorSignals {
    bool occupied{};
    std::uint8_t subsector_mask{};
};

struct VehicleObjectCanSignals {
    bool grid_valid{};
    bool perception_degraded{};
    bool object_list_overflow{};
    std::array<VehicleSectorSignals, kVehicleSectorCount> sectors{};
};

struct CanSignalValues {
    SteeringCanSignals steering;
    SpeedCanSignals speed;
    VehicleObjectCanSignals vehicle_object;
};

class CanEncoder {
public:
    // Call on each 20 ms vehicle-input cycle. Each invocation advances both
    // alive counters, including when the input scene is absent or invalid.
    CanSignalValues encode(const std::optional<RunnerScene>& scene,
                           std::uint64_t now_monotonic_ns);

private:
    std::uint8_t steering_counter_{};
    std::uint8_t speed_counter_{};
};

}  // namespace afs_bridge
