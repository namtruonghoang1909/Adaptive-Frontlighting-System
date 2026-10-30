#include "afs_bridge/socketcan_frame.hpp"

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {

using afs_bridge::CanFrame;

void require(bool condition, const std::string& message) {
    if (condition) return;
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
}

template <typename Function>
void require_throws(Function function, const std::string& message) {
    try {
        function();
    } catch (const std::invalid_argument&) {
        return;
    }
    require(false, message);
}

void test_project_frame_to_native_classical_frame() {
    CanFrame source{};
    source.can_id = 0x321;
    source.dlc = 3;
    source.data = {0x11, 0x22, 0x33, 0xaa, 0xbb, 0xcc, 0xdd, 0xee};

    const auto native = afs_bridge::to_native_can_frame(source);
    require(native.can_id == 0x321, "standard CAN identifier is preserved");
    require(native.can_dlc == 3, "DLC is preserved");
    require(native.data[0] == 0x11 && native.data[1] == 0x22 &&
                native.data[2] == 0x33,
            "payload bytes inside the DLC are copied");
    require(native.data[3] == 0 && native.data[7] == 0,
            "native padding and bytes after the DLC are zero");
}

void test_native_frame_to_project_value() {
    can_frame native{};
    native.can_id = 0x456;
    native.can_dlc = 2;
    native.data[0] = 0x7a;
    native.data[1] = 0xb3;

    const auto decoded = afs_bridge::from_native_can_frame(native);
    require(decoded.has_value(), "valid standard frame is accepted");
    require(decoded->can_id == 0x456 && decoded->dlc == 2,
            "identifier and DLC are preserved on receive");
    require(decoded->data[0] == 0x7a && decoded->data[1] == 0xb3 &&
                decoded->data[2] == 0,
            "received payload is copied and remaining bytes are zero");
}

void test_outbound_rejects_unsupported_frames() {
    CanFrame frame{};
    frame.can_id = 0x800;
    require_throws([&] { (void)afs_bridge::to_native_can_frame(frame); },
                   "extended identifiers are rejected for outbound standard CAN");

    frame.can_id = 0x100;
    frame.dlc = 9;
    require_throws([&] { (void)afs_bridge::to_native_can_frame(frame); },
                   "DLC above eight is rejected for Classical CAN");
}

void test_inbound_rejects_nonstandard_frames() {
    can_frame native{};
    native.can_id = 0x123 | CAN_EFF_FLAG;
    native.can_dlc = 1;
    require(!afs_bridge::from_native_can_frame(native),
            "extended CAN frames are rejected");

    native.can_id = 0x123 | CAN_RTR_FLAG;
    require(!afs_bridge::from_native_can_frame(native),
            "remote frames are rejected");

    native.can_id = 0x123 | CAN_ERR_FLAG;
    require(!afs_bridge::from_native_can_frame(native),
            "error frames are rejected");

    native.can_id = 0x123;
    native.can_dlc = 9;
    require(!afs_bridge::from_native_can_frame(native),
            "oversized inbound DLC is rejected");
}

}  // namespace

int main() {
    test_project_frame_to_native_classical_frame();
    test_native_frame_to_project_value();
    test_outbound_rejects_unsupported_frames();
    test_inbound_rejects_nonstandard_frames();
    std::cout << "SocketCAN frame conversion checks passed.\n";
    return EXIT_SUCCESS;
}
