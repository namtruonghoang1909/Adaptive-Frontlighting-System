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

// Packs runner-derived signal values using the C codec generated from
// bridge/can/afs.dbc. The returned order is speed, steering, vehicle object.
// This class does not schedule or transmit frames.
class CanFrameEncoder {
public:
    std::array<CanFrame, kCanFrameBatchSize> encode(
        const CanSignalValues& signals) const;
};

}  // namespace afs_bridge
