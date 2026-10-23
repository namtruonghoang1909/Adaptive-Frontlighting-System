#include "afs_bridge/socketcan_frame.hpp"

#include <algorithm>
#include <stdexcept>

namespace afs_bridge {

can_frame to_native_can_frame(const CanFrame& frame) {
    if (frame.can_id > CAN_SFF_MASK) {
        throw std::invalid_argument("SocketCAN only accepts standard 11-bit identifiers");
    }
    if (frame.dlc > CAN_MAX_DLEN) {
        throw std::invalid_argument("SocketCAN Classical CAN DLC exceeds 8 bytes");
    }

    can_frame native{};
    native.can_id = frame.can_id;
    native.can_dlc = frame.dlc;
    std::copy_n(frame.data.begin(), frame.dlc, native.data);
    return native;
}

std::optional<CanFrame> from_native_can_frame(const can_frame& native) {
    if ((native.can_id & (CAN_EFF_FLAG | CAN_RTR_FLAG | CAN_ERR_FLAG)) != 0 ||
        (native.can_id & CAN_EFF_MASK) > CAN_SFF_MASK ||
        native.can_dlc > CAN_MAX_DLEN) {
        return std::nullopt;
    }

    CanFrame frame{};
    frame.can_id = native.can_id & CAN_SFF_MASK;
    frame.dlc = native.can_dlc;
    std::copy_n(native.data, frame.dlc, frame.data.begin());
    return frame;
}

}  // namespace afs_bridge
