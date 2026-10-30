#include "afs_bridge/afs_status.hpp"

#include <cstdlib>
#include <iostream>
#include <string>

namespace {

using afs_bridge::AfsStatusDecoder;
using afs_bridge::CanFrame;

void require(bool condition, const std::string& message) {
    if (condition) return;
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
}

CanFrame status_frame(std::uint8_t counter = 1,
                      std::uint8_t executed_mode = 5,
                      std::uint8_t health = 0,
                      std::uint16_t mask = 0x0123) {
    CanFrame frame{};
    frame.can_id = 0x500;
    frame.dlc = 8;
    frame.data[0] = static_cast<std::uint8_t>((counter & 0x0f) | 0x10);
    frame.data[1] = static_cast<std::uint8_t>((executed_mode & 0x07) |
                                               ((health & 0x0f) << 4));
    frame.data[2] = 0;
    frame.data[3] = static_cast<std::uint8_t>(-3);  // -1.5 degrees
    frame.data[4] = 1;                              // +0.5 degrees
    frame.data[5] = static_cast<std::uint8_t>(mask & 0xff);
    frame.data[6] = static_cast<std::uint8_t>((mask >> 8) & 0xff);
    for (std::size_t index = 0; index < 7; ++index) frame.data[7] ^= frame.data[index];
    return frame;
}

void refresh_checksum(CanFrame& frame) {
    frame.data[7] = 0;
    for (std::size_t index = 0; index < 7; ++index) frame.data[7] ^= frame.data[index];
}

void test_valid_frame_decodes_all_fields() {
    AfsStatusDecoder decoder;
    std::string reason;
    const auto status = decoder.decode(status_frame(7, 5, 1, 0x0201), 1'000'000'000ULL, reason);
    require(status.has_value(), "valid AFS_Status frame is accepted");
    require(status->alive_counter == 7 && status->required_inputs_valid,
            "alive counter and required-input flag decode");
    require(status->executed_mode == 5 && status->health_state == 1,
            "mode and health enums decode");
    require(status->left_servo_feedback_deg == -1.5 &&
                status->right_servo_feedback_deg == 0.5,
            "scaled servo feedback decodes");
    require(status->applied_dim_sector_mask == 0x0201 &&
                status->received_monotonic_ns == 1'000'000'000ULL,
            "applied mask and host receive timestamp are retained");
}

void test_rejects_identifier_length_checksum_reserved_and_ranges() {
    std::string reason;
    AfsStatusDecoder decoder;
    auto frame = status_frame();
    frame.can_id = 0x501;
    require(!decoder.decode(frame, 1, reason) && reason == "unexpected CAN identifier",
            "wrong CAN identifier is rejected");

    frame = status_frame();
    frame.dlc = 7;
    require(!decoder.decode(frame, 1, reason) && reason == "AFS_Status DLC must be 8",
            "wrong DLC is rejected");

    frame = status_frame();
    frame.data[4] ^= 0x01;
    require(!decoder.decode(frame, 1, reason) && reason == "AFS_Status checksum mismatch",
            "bad XOR checksum is rejected");

    frame = status_frame();
    frame.data[0] |= 0x80;
    refresh_checksum(frame);
    require(!decoder.decode(frame, 1, reason) && reason.find("reserved") != std::string::npos,
            "reserved status bits are rejected after checksum validation");

    frame = status_frame(1, 6, 0);
    require(!decoder.decode(frame, 1, reason) && reason.find("enum") != std::string::npos,
            "reserved executed-mode enum is rejected");

    frame = status_frame(1, 1, 4);
    require(!decoder.decode(frame, 1, reason) && reason.find("enum") != std::string::npos,
            "reserved health enum is rejected");

    frame = status_frame(1, 1, 0, 0x0400);
    require(!decoder.decode(frame, 1, reason) && reason.find("mask") != std::string::npos,
            "reserved applied-mask bits are rejected");
}

void test_counter_progression_and_quiet_restart_policy() {
    std::string reason;
    AfsStatusDecoder decoder;
    require(decoder.decode(status_frame(14), 1'000'000'000ULL, reason).has_value(),
            "first valid counter establishes baseline");
    require(decoder.decode(status_frame(6), 1'050'000'000ULL, reason).has_value(),
            "forward gap of eight counters is accepted across rollover");
    require(!decoder.decode(status_frame(6), 1'100'000'000ULL, reason) &&
                reason.find("repeated") != std::string::npos,
            "duplicate counter is rejected");
    require(!decoder.decode(status_frame(1), 1'150'000'000ULL, reason) &&
                reason.find("backwards") != std::string::npos,
            "backwards counter is rejected before quiet timeout");
    require(decoder.decode(status_frame(1), 1'600'000'001ULL, reason).has_value(),
            "counter restart is accepted after more than 500 ms quiet");
    require(!decoder.decode(status_frame(2), 1'500'000'000ULL, reason) &&
                reason.find("backwards") != std::string::npos,
            "receive timestamp rollback is rejected");
}

}  // namespace

int main() {
    test_valid_frame_decodes_all_fields();
    test_rejects_identifier_length_checksum_reserved_and_ranges();
    test_counter_progression_and_quiet_restart_policy();
    std::cout << "AFS_Status decoder checks passed.\n";
    return EXIT_SUCCESS;
}
