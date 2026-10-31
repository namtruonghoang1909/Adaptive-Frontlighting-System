#pragma once

#include "afs_bridge/can_encoder.hpp"

#include <array>
#include <cstddef>
#include <cstdint>

namespace afs_bridge {

inline constexpr std::size_t kCanPayloadCapacity = 8;
inline constexpr std::size_t kCanFrameBatchSize = 3;

// Standard Classical CAN frame value. Bytes after dlc remain zero.
struct CanFrame {
    std::uint32_t can_id{};
    std::uint8_t dlc{};
    std::array<std::uint8_t, kCanPayloadCapacity> data{};
};

struct DashboardCommandCanSignals {
    std::uint8_t alive_counter{};
    bool valid{};
    bool clear_fault_request{};
    bool power_on{};
    std::uint8_t mode{};
};

// Packs signal values using the C codec generated from bridge/can/afs.dbc.
// The batch contains speed, steering, and vehicle object. Dashboard commands
// are packed separately because they have an independent 50 ms schedule.
class CanFrameEncoder {
public:
    std::array<CanFrame, kCanFrameBatchSize> encode(
        const CanSignalValues& signals) const;
    CanFrame encode_dashboard_command(
        const DashboardCommandCanSignals& signals) const;
};

}  // namespace afs_bridge
