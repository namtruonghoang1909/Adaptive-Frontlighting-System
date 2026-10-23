#include "afs_bridge/afs_status.hpp"

#include "afs.h"

#include <array>
#include <cstdint>

namespace afs_bridge {

std::optional<AfsStatus> AfsStatusDecoder::decode(
    const CanFrame& frame, std::uint64_t received_monotonic_ns,
    std::string& rejection_reason) {
    rejection_reason.clear();
    if (frame.can_id != AFS_AFS_STATUS_FRAME_ID) {
        rejection_reason = "unexpected CAN identifier";
        return std::nullopt;
    }
    if (frame.dlc != AFS_AFS_STATUS_LENGTH) {
        rejection_reason = "AFS_Status DLC must be 8";
        return std::nullopt;
    }

    std::uint8_t checksum = 0;
    for (std::size_t index = 0; index < 7; ++index) checksum ^= frame.data[index];
    if (checksum != frame.data[7]) {
        rejection_reason = "AFS_Status checksum mismatch";
        return std::nullopt;
    }

    afs_afs_status_t message{};
    if (afs_afs_status_unpack(&message, frame.data.data(), frame.dlc) != 0) {
        rejection_reason = "generated AFS_Status decoder rejected the payload";
        return std::nullopt;
    }
    if (message.status_reserved_bit7 != 0 || message.status_reserved_bit11 != 0) {
        rejection_reason = "AFS_Status reserved bit is nonzero";
        return std::nullopt;
    }
    if (message.executed_mode > AFS_AFS_STATUS_EXECUTED_MODE_HIGH_BEAM_DIMMING_CHOICE ||
        message.health_state > AFS_AFS_STATUS_HEALTH_STATE_SAFE_FALLBACK_CHOICE) {
        rejection_reason = "AFS_Status enum value is reserved";
        return std::nullopt;
    }
    if ((message.applied_dim_sector_mask & 0xfc00U) != 0) {
        rejection_reason = "AFS_Status dim-sector mask uses reserved bits";
        return std::nullopt;
    }
    if (has_counter_) {
        if (received_monotonic_ns < last_received_monotonic_ns_) {
            rejection_reason = "AFS_Status receive timestamp moved backwards";
            return std::nullopt;
        }
        const auto elapsed_ns = received_monotonic_ns - last_received_monotonic_ns_;
        const auto counter_delta = static_cast<std::uint8_t>(
            (message.alive_counter - last_counter_) & 0x0fU);
        const bool can_resynchronize = elapsed_ns > 500'000'000ULL;
        if (counter_delta == 0) {
            rejection_reason = "AFS_Status alive counter repeated";
            return std::nullopt;
        }
        if (counter_delta > 8 && !can_resynchronize) {
            rejection_reason = "AFS_Status alive counter moved backwards";
            return std::nullopt;
        }
    }

    AfsStatus status{};
    status.alive_counter = message.alive_counter;
    status.required_inputs_valid = message.required_inputs_valid != 0;
    status.fault_present = message.fault_present != 0;
    status.safe_fallback = message.safe_fallback != 0;
    status.executed_mode = message.executed_mode;
    status.health_state = message.health_state;
    status.steering_stale = message.steering_stale != 0;
    status.speed_stale = message.speed_stale != 0;
    status.object_stale = message.object_stale != 0;
    status.dashboard_stale = message.dashboard_stale != 0;
    status.servo_control_lost = message.servo_control_lost != 0;
    status.servo_mismatch = message.servo_mismatch != 0;
    status.beam_control_lost = message.beam_control_lost != 0;
    status.can_decode_fault = message.can_decode_fault != 0;
    status.left_servo_feedback_deg =
        afs_afs_status_left_servo_feedback_deg_decode(message.left_servo_feedback_deg);
    status.right_servo_feedback_deg =
        afs_afs_status_right_servo_feedback_deg_decode(message.right_servo_feedback_deg);
    status.applied_dim_sector_mask = message.applied_dim_sector_mask;
    status.received_monotonic_ns = received_monotonic_ns;

    has_counter_ = true;
    last_counter_ = message.alive_counter;
    last_received_monotonic_ns_ = received_monotonic_ns;
    return status;
}

}  // namespace afs_bridge
