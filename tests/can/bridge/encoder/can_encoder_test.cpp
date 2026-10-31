#include "afs_bridge/can_encoder.hpp"

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <optional>
#include <string>

namespace {

using afs_bridge::CanEncoder;
using afs_bridge::CanSignalValues;
using afs_bridge::RunnerObject;
using afs_bridge::RunnerScene;

constexpr std::uint64_t kNowNs = 10'000'000'000ULL;

void require(bool condition, const std::string& message) {
    if (condition) return;
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
}

RunnerScene valid_scene() {
    RunnerScene scene;
    scene.captured_monotonic_ns = kNowNs;
    scene.ego_valid = true;
    scene.objects_valid = true;
    scene.ipc_faulted = false;
    scene.has_steering = true;
    scene.max_steering_deg = 60.0;
    scene.steering_deg = 12.3;
    scene.has_speed = true;
    scene.longitudinal_speed_mps = 10.0;
    return scene;
}

RunnerObject vehicle(double range_m, double angle_deg,
                     double length_m = 0.2, double width_m = 0.2) {
    const double angle_rad = angle_deg * std::acos(-1.0) / 180.0;
    RunnerObject object;
    object.id = "vehicle";
    object.type = "VEHICLE";
    object.x_forward_m = range_m * std::cos(angle_rad);
    object.y_left_m = range_m * std::sin(angle_rad);
    object.length_m = length_m;
    object.width_m = width_m;
    object.relative_heading_rad = 0.0;
    return object;
}

void test_signed_and_scaled_values() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.longitudinal_speed_mps = -5.0;
    const auto values = encoder.encode(scene, kNowNs);
    require(values.steering.valid && !values.steering.saturated,
            "valid steering source accepted");
    require(std::abs(values.steering.angle_deg - 12.3) < 1e-9,
            "steering remains in degrees at the 0.1-degree CAN resolution");
    require(values.speed.valid && !values.speed.saturated,
            "valid signed speed source accepted");
    require(std::abs(values.speed.longitudinal_speed_mps + 5.0) < 1e-9,
            "negative speed preserves reverse direction");
}

void test_steering_limit_and_can_field_saturation() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.steering_deg = 12.0;
    scene.max_steering_deg = 10.0;
    auto values = encoder.encode(scene, kNowNs);
    require(!values.steering.valid && !values.steering.saturated,
            "angle beyond the active MetaDrive limit is invalid, not CAN-saturated");
    require(values.steering.angle_deg == 0.0,
            "invalid steering signal value is cleared");

    scene = valid_scene();
    scene.max_steering_deg = 4000.0;
    scene.steering_deg = 3500.0;
    values = encoder.encode(scene, kNowNs);
    require(!values.steering.valid && values.steering.saturated,
            "steering outside int16 CAN range is saturated and invalid");
    require(std::abs(values.steering.angle_deg - 3276.7) < 1e-9,
            "positive steering saturation clamps to the representable field maximum");

    scene.steering_deg = -3500.0;
    values = encoder.encode(scene, kNowNs);
    require(values.steering.saturated && !values.steering.valid,
            "negative steering outside int16 CAN range is saturated and invalid");
    require(std::abs(values.steering.angle_deg + 3276.8) < 1e-9,
            "negative steering clamps to the representable field minimum");
}

void test_speed_saturation_and_reserved_signal_defaults() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.longitudinal_speed_mps = 400.0;
    const auto values = encoder.encode(scene, kNowNs);
    require(values.speed.saturated && !values.speed.valid,
            "speed outside int16 CAN range is saturated and invalid");
    require(std::abs(values.speed.longitudinal_speed_mps - 327.67) < 1e-9,
            "speed clamps to the representable field maximum");
    require(values.vehicle_object.sectors[0].subsector_mask == 0,
            "empty valid grid starts with zero sector masks");
}

void test_stale_faulted_and_absent_scenes_fail_closed() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.captured_monotonic_ns = kNowNs - 250'000'001ULL;
    auto values = encoder.encode(scene, kNowNs);
    require(!values.steering.valid && !values.speed.valid &&
                !values.vehicle_object.grid_valid,
            "stale scene invalidates all runner-derived inputs");

    scene = valid_scene();
    scene.ipc_faulted = true;
    values = encoder.encode(scene, kNowNs);
    require(!values.steering.valid && !values.speed.valid &&
                !values.vehicle_object.grid_valid,
            "latched IPC fault invalidates all runner-derived inputs");
    require(!values.vehicle_object.perception_degraded,
            "transport fault alone does not set perception diagnostics");

    values = encoder.encode(std::nullopt, kNowNs);
    require(!values.steering.valid && !values.speed.valid &&
                !values.vehicle_object.grid_valid,
            "absent scene produces invalid signals");
}

void test_alive_counters_advance_and_roll_over() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.has_speed = false;
    for (std::uint8_t expected = 0; expected < 16; ++expected) {
        const auto values = encoder.encode(scene, kNowNs);
        require(values.steering.alive_counter == expected,
                "steering alive counter increments each output cycle");
        require(values.speed.alive_counter == expected,
                "speed alive counter increments even when the source is unavailable");
    }
    const auto rolled = encoder.encode(scene, kNowNs);
    require(rolled.steering.alive_counter == 0 &&
                rolled.speed.alive_counter == 0,
            "alive counters roll over modulo 16");
}

void test_empty_degraded_and_truncated_grid_states() {
    CanEncoder encoder;
    auto scene = valid_scene();
    auto values = encoder.encode(scene, kNowNs);
    require(values.vehicle_object.grid_valid &&
                !values.vehicle_object.perception_degraded &&
                !values.vehicle_object.object_list_overflow,
            "fresh valid empty scan is a valid clear grid");

    scene.objects_valid = false;
    values = encoder.encode(scene, kNowNs);
    require(!values.vehicle_object.grid_valid &&
                values.vehicle_object.perception_degraded,
            "invalid object scan invalidates the grid as degraded");

    scene = valid_scene();
    scene.objects_degraded = true;
    values = encoder.encode(scene, kNowNs);
    require(!values.vehicle_object.grid_valid &&
                values.vehicle_object.perception_degraded,
            "degraded object scan invalidates the grid");

    scene = valid_scene();
    scene.objects_truncated = true;
    scene.objects_degraded = true;
    values = encoder.encode(scene, kNowNs);
    require(!values.vehicle_object.grid_valid &&
                values.vehicle_object.perception_degraded &&
                values.vehicle_object.object_list_overflow,
            "truncated scan reports both perception degradation and overflow");
}

void test_vehicle_sector_and_band_masks() {
    // Sector centers, from the leftmost edge to the rightmost edge.
    constexpr double sector_centers_deg[] = {
        12.5, 9.2, 6.2, 3.4, 1.0, -1.0, -3.4, -6.2, -9.2, -12.5};
    constexpr double ranges_m[] = {12.0, 37.0, 62.0, 87.0};
    constexpr std::uint8_t masks[] = {0x0f, 0x07, 0x03, 0x01};

    for (std::size_t sector = 0; sector < 10; ++sector) {
        for (std::size_t band = 0; band < 4; ++band) {
            CanEncoder encoder;
            auto scene = valid_scene();
            scene.objects.push_back(vehicle(ranges_m[band],
                                            sector_centers_deg[sector]));
            const CanSignalValues values = encoder.encode(scene, kNowNs);
            require(values.vehicle_object.grid_valid,
                    "complete vehicle geometry produces a valid grid");
            require(values.vehicle_object.sectors[sector].occupied,
                    "vehicle marks its angular sector occupied");
            require(values.vehicle_object.sectors[sector].subsector_mask ==
                        masks[band],
                    "radial band selects the agreed cumulative mask");
        }
    }
}

void test_overlapping_vehicles_or_their_masks() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.objects.push_back(vehicle(20.0, 3.4));
    scene.objects.push_back(vehicle(60.0, 3.4));
    const auto values = encoder.encode(scene, kNowNs);
    require(values.vehicle_object.sectors[3].occupied,
            "overlapping vehicles preserve sector occupancy");
    require(values.vehicle_object.sectors[3].subsector_mask == 0x0f,
            "overlapping vehicle masks combine by bitwise OR");
}

void test_missing_vehicle_geometry_invalidates_entire_grid() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.objects.push_back(vehicle(20.0, 3.4));
    RunnerObject incomplete;
    incomplete.id = "incomplete";
    incomplete.type = "VEHICLE";
    incomplete.x_forward_m = 30.0;
    incomplete.y_left_m = 0.0;
    incomplete.length_m = 4.0;
    incomplete.relative_heading_rad = 0.0;
    scene.objects.push_back(incomplete);

    const auto values = encoder.encode(scene, kNowNs);
    require(!values.vehicle_object.grid_valid &&
                values.vehicle_object.perception_degraded,
            "missing geometry invalidates the whole grid");
    for (const auto& sector : values.vehicle_object.sectors) {
        require(!sector.occupied && sector.subsector_mask == 0,
                "invalid geometry clears all accumulated sector records");
    }
}

void test_objects_outside_range_and_non_vehicles() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.objects.push_back(vehicle(120.0, 3.4));
    RunnerObject pedestrian = vehicle(10.0, 3.4);
    pedestrian.type = "PEDESTRIAN";
    pedestrian.length_m.reset();
    pedestrian.width_m.reset();
    pedestrian.relative_heading_rad.reset();
    scene.objects.push_back(pedestrian);

    const auto values = encoder.encode(scene, kNowNs);
    require(values.vehicle_object.grid_valid,
            "out-of-range vehicles and non-vehicles do not degrade the scan");
    for (const auto& sector : values.vehicle_object.sectors) {
        require(!sector.occupied && sector.subsector_mask == 0,
                "out-of-range and non-vehicle objects do not populate sectors");
    }
}

void test_vehicle_footprint_overlaps_sector_boundary() {
    CanEncoder encoder;
    auto scene = valid_scene();
    scene.objects.push_back(vehicle(20.0, 10.85, 4.0, 2.0));
    const auto values = encoder.encode(scene, kNowNs);
    require(values.vehicle_object.grid_valid,
            "footprint crossing a sector edge remains a valid grid");
    require(values.vehicle_object.sectors[0].occupied &&
                values.vehicle_object.sectors[1].occupied,
            "full footprint marks every horizontal sector it overlaps");
}

}  // namespace

int main() {
    test_signed_and_scaled_values();
    test_steering_limit_and_can_field_saturation();
    test_speed_saturation_and_reserved_signal_defaults();
    test_stale_faulted_and_absent_scenes_fail_closed();
    test_alive_counters_advance_and_roll_over();
    test_empty_degraded_and_truncated_grid_states();
    test_vehicle_sector_and_band_masks();
    test_overlapping_vehicles_or_their_masks();
    test_missing_vehicle_geometry_invalidates_entire_grid();
    test_objects_outside_range_and_non_vehicles();
    test_vehicle_footprint_overlaps_sector_boundary();
    std::cout << "CAN signal validation and projection checks passed.\n";
    return EXIT_SUCCESS;
}
