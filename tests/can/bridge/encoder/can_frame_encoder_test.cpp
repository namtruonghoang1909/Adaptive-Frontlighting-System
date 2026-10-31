#include "afs_bridge/can_frame_encoder.hpp"

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {

void require(bool condition, const std::string& message) {
    if (condition) return;
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
}

void test_dashboard_command_golden_vector_and_checksum() {
    afs_bridge::CanFrameEncoder encoder;
    const auto frame = encoder.encode_dashboard_command({
        4, true, false, true, 3,
    });
    require(frame.can_id == 0x400 && frame.dlc == 3,
            "Dashboard command uses the DBC identifier and three-byte length");
    require(frame.data[0] == 0x14 && frame.data[1] == 0x07 &&
                frame.data[2] == 0x13,
            "Dashboard command matches the documented golden payload");
    require(frame.data[2] == static_cast<std::uint8_t>(frame.data[0] ^ frame.data[1]),
            "Dashboard command checksum is XOR of the first two bytes");
}

void test_invalid_mode_is_rejected() {
    afs_bridge::CanFrameEncoder encoder;
    bool threw = false;
    try {
        (void)encoder.encode_dashboard_command({0, false, false, false, 4});
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    require(threw, "reserved Dashboard mode value is rejected before packing");
}

}  // namespace

int main() {
    test_dashboard_command_golden_vector_and_checksum();
    test_invalid_mode_is_rejected();
    std::cout << "CAN frame encoder checks passed.\n";
    return EXIT_SUCCESS;
}
