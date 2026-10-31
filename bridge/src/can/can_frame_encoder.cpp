#include "afs_bridge/can_frame_encoder.hpp"

#include "afs.h"

#include <stdexcept>

namespace afs_bridge {
namespace {

template <typename Message>
CanFrame pack_frame(std::uint32_t can_id, std::size_t dlc,
                    int (*pack)(std::uint8_t*, const Message*, std::size_t),
                    const Message& message) {
    CanFrame frame{};
    frame.can_id = can_id;
    frame.dlc = static_cast<std::uint8_t>(dlc);
    const int packed_size = pack(frame.data.data(), &message, frame.data.size());
    if (packed_size != static_cast<int>(dlc)) {
        throw std::logic_error("DBC message packer rejected its fixed CAN frame");
    }
    return frame;
}

afs_vehicle_speed_t encode_speed(const SpeedCanSignals& signals) {
    // Value initialization keeps every reserved field at zero.
    afs_vehicle_speed_t message{};
    message.alive_counter = afs_vehicle_speed_alive_counter_encode(
        signals.alive_counter);
    message.speed_valid = afs_vehicle_speed_speed_valid_encode(signals.valid);
    message.speed_saturated = afs_vehicle_speed_speed_saturated_encode(
        signals.saturated);
    message.longitudinal_speed_mps =
        afs_vehicle_speed_longitudinal_speed_mps_encode(
            signals.longitudinal_speed_mps);
    return message;
}

afs_vehicle_steering_t encode_steering(const SteeringCanSignals& signals) {
    // Value initialization keeps every reserved field at zero.
    afs_vehicle_steering_t message{};
    message.alive_counter = afs_vehicle_steering_alive_counter_encode(
        signals.alive_counter);
    message.steering_valid = afs_vehicle_steering_steering_valid_encode(
        signals.valid);
    message.steering_saturated = afs_vehicle_steering_steering_saturated_encode(
        signals.saturated);
    message.steering_angle_deg = afs_vehicle_steering_steering_angle_deg_encode(
        signals.angle_deg);
    return message;
}

afs_vehicle_object_t encode_vehicle_object(
    const VehicleObjectCanSignals& signals) {
    // Value initialization keeps byte 0 and bits 61..63 reserved as zero.
    afs_vehicle_object_t message{};
    message.grid_valid = afs_vehicle_object_grid_valid_encode(
        signals.grid_valid);
    message.perception_degraded = afs_vehicle_object_perception_degraded_encode(
        signals.perception_degraded);
    message.object_list_overflow = afs_vehicle_object_object_list_overflow_encode(
        signals.object_list_overflow);

    message.sector00_occupied = afs_vehicle_object_sector00_occupied_encode(
        signals.sectors[0].occupied);
    message.sector00_subsector_mask =
        afs_vehicle_object_sector00_subsector_mask_encode(
            signals.sectors[0].subsector_mask);
    message.sector01_occupied = afs_vehicle_object_sector01_occupied_encode(
        signals.sectors[1].occupied);
    message.sector01_subsector_mask =
        afs_vehicle_object_sector01_subsector_mask_encode(
            signals.sectors[1].subsector_mask);
    message.sector02_occupied = afs_vehicle_object_sector02_occupied_encode(
        signals.sectors[2].occupied);
    message.sector02_subsector_mask =
        afs_vehicle_object_sector02_subsector_mask_encode(
            signals.sectors[2].subsector_mask);
    message.sector03_occupied = afs_vehicle_object_sector03_occupied_encode(
        signals.sectors[3].occupied);
    message.sector03_subsector_mask =
        afs_vehicle_object_sector03_subsector_mask_encode(
            signals.sectors[3].subsector_mask);
    message.sector04_occupied = afs_vehicle_object_sector04_occupied_encode(
        signals.sectors[4].occupied);
    message.sector04_subsector_mask =
        afs_vehicle_object_sector04_subsector_mask_encode(
            signals.sectors[4].subsector_mask);
    message.sector05_occupied = afs_vehicle_object_sector05_occupied_encode(
        signals.sectors[5].occupied);
    message.sector05_subsector_mask =
        afs_vehicle_object_sector05_subsector_mask_encode(
            signals.sectors[5].subsector_mask);
    message.sector06_occupied = afs_vehicle_object_sector06_occupied_encode(
        signals.sectors[6].occupied);
    message.sector06_subsector_mask =
        afs_vehicle_object_sector06_subsector_mask_encode(
            signals.sectors[6].subsector_mask);
    message.sector07_occupied = afs_vehicle_object_sector07_occupied_encode(
        signals.sectors[7].occupied);
    message.sector07_subsector_mask =
        afs_vehicle_object_sector07_subsector_mask_encode(
            signals.sectors[7].subsector_mask);
    message.sector08_occupied = afs_vehicle_object_sector08_occupied_encode(
        signals.sectors[8].occupied);
    message.sector08_subsector_mask =
        afs_vehicle_object_sector08_subsector_mask_encode(
            signals.sectors[8].subsector_mask);
    message.sector09_occupied = afs_vehicle_object_sector09_occupied_encode(
        signals.sectors[9].occupied);
    message.sector09_subsector_mask =
        afs_vehicle_object_sector09_subsector_mask_encode(
            signals.sectors[9].subsector_mask);
    return message;
}

}  // namespace

std::array<CanFrame, kCanFrameBatchSize> CanFrameEncoder::encode(
    const CanSignalValues& signals) const {
    const auto speed = encode_speed(signals.speed);
    const auto steering = encode_steering(signals.steering);
    const auto vehicle_object = encode_vehicle_object(signals.vehicle_object);

    return {{
        pack_frame(AFS_VEHICLE_SPEED_FRAME_ID, AFS_VEHICLE_SPEED_LENGTH,
                   &afs_vehicle_speed_pack, speed),
        pack_frame(AFS_VEHICLE_STEERING_FRAME_ID, AFS_VEHICLE_STEERING_LENGTH,
                   &afs_vehicle_steering_pack, steering),
        pack_frame(AFS_VEHICLE_OBJECT_FRAME_ID, AFS_VEHICLE_OBJECT_LENGTH,
                   &afs_vehicle_object_pack, vehicle_object),
    }};
}

CanFrame CanFrameEncoder::encode_dashboard_command(
    const DashboardCommandCanSignals& signals) const {
    if (signals.mode > AFS_DASHBOARD_COMMAND_REQUESTED_HEADLIGHT_MODE_HIGH_BEAM_DIMMING_CHOICE) {
        throw std::invalid_argument("Dashboard command mode is outside the DBC enum");
    }

    afs_dashboard_command_t message{};
    message.alive_counter = afs_dashboard_command_alive_counter_encode(
        signals.alive_counter);
    message.command_valid = afs_dashboard_command_command_valid_encode(
        signals.valid);
    message.clear_fault_request = afs_dashboard_command_clear_fault_request_encode(
        signals.clear_fault_request);
    message.requested_headlight_power =
        afs_dashboard_command_requested_headlight_power_encode(signals.power_on);
    message.requested_headlight_mode =
        afs_dashboard_command_requested_headlight_mode_encode(signals.mode);

    auto frame = pack_frame(AFS_DASHBOARD_COMMAND_FRAME_ID,
                            AFS_DASHBOARD_COMMAND_LENGTH,
                            &afs_dashboard_command_pack, message);
    message.checksum = afs_dashboard_command_checksum_encode(
        static_cast<std::uint8_t>(frame.data[0] ^ frame.data[1]));
    return pack_frame(AFS_DASHBOARD_COMMAND_FRAME_ID,
                      AFS_DASHBOARD_COMMAND_LENGTH,
                      &afs_dashboard_command_pack, message);
}

}  // namespace afs_bridge
