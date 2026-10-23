#pragma once

#include "afs_bridge/can_frame_encoder.hpp"

#include <cstdint>
#include <optional>
#include <string>

namespace afs_bridge {

struct AfsStatus {
    std::uint8_t alive_counter{};
    bool required_inputs_valid{};
    bool fault_present{};
    bool safe_fallback{};
    std::uint8_t executed_mode{};
    std::uint8_t health_state{};
    bool steering_stale{};
    bool speed_stale{};
    bool object_stale{};
    bool dashboard_stale{};
    bool servo_control_lost{};
    bool servo_mismatch{};
    bool beam_control_lost{};
    bool can_decode_fault{};
    double left_servo_feedback_deg{};
    double right_servo_feedback_deg{};
    std::uint16_t applied_dim_sector_mask{};
    std::uint64_t received_monotonic_ns{};
};

// Validates the generated DBC payload plus the project checksum and heartbeat
// policy. The first valid sample establishes the counter baseline. Forward
// gaps up to half the 4-bit counter space are accepted. Duplicate counters are
// always rejected; a backwards jump is accepted as a restarted counter only
// after a quiet interval longer than 500 ms.
class AfsStatusDecoder {
public:
    std::optional<AfsStatus> decode(const CanFrame& frame,
                                    std::uint64_t received_monotonic_ns,
                                    std::string& rejection_reason);

private:
    bool has_counter_{};
    std::uint8_t last_counter_{};
    std::uint64_t last_received_monotonic_ns_{};
};

}  // namespace afs_bridge
