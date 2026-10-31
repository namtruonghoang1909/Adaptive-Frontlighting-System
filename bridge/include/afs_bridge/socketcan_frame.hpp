#pragma once

#include "afs_bridge/can_frame_encoder.hpp"

#include <linux/can.h>

#include <optional>

namespace afs_bridge {

// Converts between the portable project frame value and Linux Classical CAN.
// Non-standard, remote, error, or oversized native frames are rejected.
can_frame to_native_can_frame(const CanFrame& frame);
std::optional<CanFrame> from_native_can_frame(const can_frame& frame);

}  // namespace afs_bridge
