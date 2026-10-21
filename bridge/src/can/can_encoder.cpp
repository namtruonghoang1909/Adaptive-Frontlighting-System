#include "afs_bridge/can_encoder.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <vector>

namespace afs_bridge {
namespace {

constexpr std::uint64_t kMaxSceneAgeNs = 250'000'000ULL;
constexpr double kSteeringScaleDeg = 0.1;
constexpr double kSpeedScaleMps = 0.01;
constexpr double kSteeringRawMin = -32768.0;
constexpr double kSteeringRawMax = 32767.0;
constexpr double kSpeedRawMin = -32768.0;
constexpr double kSpeedRawMax = 32767.0;
constexpr double kGridRangeM = 100.0;
constexpr std::array<double, 4> kBandLowerM{0.0, 25.0, 50.0, 75.0};
constexpr std::array<double, 4> kBandUpperM{25.0, 50.0, 75.0, 100.0};
constexpr std::array<std::uint8_t, 4> kBandMasks{0x0f, 0x07, 0x03, 0x01};
constexpr std::array<double, 11> kFarFieldSectorBoundariesDeg{
    14.223, 10.882, 7.705, 4.737, 2.062, 0.0,
    -2.062, -4.737, -7.705, -10.882, -14.223};

struct Point {
    double x{};
    double y{};
};

struct VehicleFootprint {
    std::array<Point, 4> corners{};
    double nearest_distance_m{};
    double farthest_distance_m{};
};

std::uint8_t advance_counter(std::uint8_t& counter) {
    const auto value = counter;
    counter = static_cast<std::uint8_t>((counter + 1U) & 0x0fU);
    return value;
}

bool scene_is_fresh(const RunnerScene& scene, std::uint64_t now_ns) {
    return now_ns >= scene.captured_monotonic_ns &&
           now_ns - scene.captured_monotonic_ns <= kMaxSceneAgeNs;
}

double quantized_can_value(double value, double scale, double raw_min,
                           double raw_max, bool& saturated) {
    const double unrounded_raw = value / scale;
    if (!std::isfinite(unrounded_raw)) {
        saturated = true;
        return std::signbit(value) ? raw_min * scale : raw_max * scale;
    }

    // Saturation describes a physical input outside the signal range, even
    // when rounding would otherwise pull it back onto an endpoint code.
    if (unrounded_raw < raw_min) {
        saturated = true;
        return raw_min * scale;
    }
    if (unrounded_raw > raw_max) {
        saturated = true;
        return raw_max * scale;
    }

    const double rounded_raw = std::round(unrounded_raw);
    return rounded_raw * scale;
}

double cross(const Point& a, const Point& b, const Point& p) {
    return (b.x - a.x) * (p.y - a.y) -
           (b.y - a.y) * (p.x - a.x);
}

bool point_in_polygon(const std::array<Point, 4>& polygon, const Point& point) {
    bool positive = false;
    bool negative = false;
    for (std::size_t i = 0; i < polygon.size(); ++i) {
        const double side = cross(polygon[i], polygon[(i + 1) % polygon.size()], point);
        positive = positive || side > 1e-9;
        negative = negative || side < -1e-9;
    }
    return !(positive && negative);
}

double distance_to_segment(const Point& point, const Point& a, const Point& b) {
    const double dx = b.x - a.x;
    const double dy = b.y - a.y;
    const double length_squared = dx * dx + dy * dy;
    if (length_squared <= std::numeric_limits<double>::epsilon()) {
        return std::hypot(point.x - a.x, point.y - a.y);
    }
    const double t = std::clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) /
                                    length_squared,
                                0.0, 1.0);
    return std::hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

bool make_footprint(const RunnerObject& object, VehicleFootprint& footprint) {
    if (!object.length_m || !object.width_m || !object.relative_heading_rad ||
        !std::isfinite(*object.length_m) || !std::isfinite(*object.width_m) ||
        !std::isfinite(*object.relative_heading_rad) ||
        *object.length_m <= 0.0 || *object.width_m <= 0.0 ||
        !std::isfinite(object.x_forward_m) || !std::isfinite(object.y_left_m)) {
        return false;
    }

    const double half_length = *object.length_m * 0.5;
    const double half_width = *object.width_m * 0.5;
    const double cosine = std::cos(*object.relative_heading_rad);
    const double sine = std::sin(*object.relative_heading_rad);
    const std::array<std::array<double, 2>, 4> local_corners{{
        {{-half_length, -half_width}},
        {{ half_length, -half_width}},
        {{ half_length,  half_width}},
        {{-half_length,  half_width}},
    }};

    footprint.nearest_distance_m = std::numeric_limits<double>::infinity();
    footprint.farthest_distance_m = 0.0;
    for (std::size_t i = 0; i < local_corners.size(); ++i) {
        const double along = local_corners[i][0];
        const double across = local_corners[i][1];
        footprint.corners[i] = {
            object.x_forward_m + cosine * along - sine * across,
            object.y_left_m + sine * along + cosine * across};
        const double radius = std::hypot(footprint.corners[i].x,
                                         footprint.corners[i].y);
        footprint.farthest_distance_m = std::max(footprint.farthest_distance_m, radius);
    }

    const Point ego{};
    if (point_in_polygon(footprint.corners, ego)) {
        footprint.nearest_distance_m = 0.0;
    } else {
        for (std::size_t i = 0; i < footprint.corners.size(); ++i) {
            footprint.nearest_distance_m = std::min(
                footprint.nearest_distance_m,
                distance_to_segment(ego, footprint.corners[i],
                                    footprint.corners[(i + 1) % footprint.corners.size()]));
        }
    }
    return std::isfinite(footprint.nearest_distance_m) &&
           std::isfinite(footprint.farthest_distance_m);
}

double normalize_angle_deg(double angle_deg) {
    double normalized = std::fmod(angle_deg, 360.0);
    if (normalized < 0.0) normalized += 360.0;
    return normalized;
}

double near_field_outer_boundary(double nearest_distance_m) {
    if (nearest_distance_m <= 30.0) return 18.0;
    if (nearest_distance_m >= 50.0) return 14.223;
    const double blend = (nearest_distance_m - 30.0) / 20.0;
    return 18.0 + blend * (14.223 - 18.0);
}

bool angular_arc_intersects_sector(double arc_start_deg, double arc_end_deg,
                                   double sector_low_deg, double sector_high_deg) {
    for (const double shift : {-360.0, 0.0, 360.0}) {
        const double low = sector_low_deg + shift;
        const double high = sector_high_deg + shift;
        if (arc_end_deg >= low && arc_start_deg <= high) return true;
    }
    return false;
}

std::array<bool, kVehicleSectorCount> covered_sectors(
    const VehicleFootprint& footprint) {
    std::array<bool, kVehicleSectorCount> covered{};
    const Point ego{};
    if (point_in_polygon(footprint.corners, ego)) {
        covered.fill(true);
        return covered;
    }

    std::array<double, 4> angles{};
    for (std::size_t i = 0; i < footprint.corners.size(); ++i) {
        angles[i] = normalize_angle_deg(std::atan2(footprint.corners[i].y,
                                                   footprint.corners[i].x) *
                                        180.0 / std::acos(-1.0));
    }
    std::sort(angles.begin(), angles.end());

    double largest_gap = -1.0;
    std::size_t gap_index = 0;
    for (std::size_t i = 0; i < angles.size(); ++i) {
        const double next = i + 1 < angles.size() ? angles[i + 1] : angles[0] + 360.0;
        const double gap = next - angles[i];
        if (gap > largest_gap) {
            largest_gap = gap;
            gap_index = i;
        }
    }
    const std::size_t arc_first = (gap_index + 1) % angles.size();
    const double arc_start = angles[arc_first];
    const double arc_width = 360.0 - largest_gap;
    const double arc_end = arc_start + arc_width;

    const double outer_boundary = near_field_outer_boundary(footprint.nearest_distance_m);
    for (std::size_t sector = 0; sector < kVehicleSectorCount; ++sector) {
        const double high = sector == 0
                                ? outer_boundary
                                : kFarFieldSectorBoundariesDeg[sector];
        const double low = sector == kVehicleSectorCount - 1
                               ? -outer_boundary
                               : kFarFieldSectorBoundariesDeg[sector + 1];
        covered[sector] = angular_arc_intersects_sector(arc_start, arc_end, low, high);
    }
    return covered;
}

std::uint8_t radial_mask(double nearest_distance_m, double farthest_distance_m) {
    const double near = std::max(0.0, nearest_distance_m);
    const double far = std::min(kGridRangeM, farthest_distance_m);
    if (near > kGridRangeM || far < 0.0 || near > far) return 0;

    std::uint8_t mask = 0;
    for (std::size_t band = 0; band < kBandMasks.size(); ++band) {
        const bool intersects = band == kBandMasks.size() - 1
                                    ? near <= kBandUpperM[band] &&
                                          far >= kBandLowerM[band]
                                    : near < kBandUpperM[band] &&
                                          far >= kBandLowerM[band];
        if (intersects) mask = static_cast<std::uint8_t>(mask | kBandMasks[band]);
    }
    return mask;
}

bool make_vehicle_grid(const RunnerScene& scene, VehicleObjectCanSignals& grid) {
    std::array<VehicleSectorSignals, kVehicleSectorCount> candidate{};
    for (const auto& object : scene.objects) {
        if (object.type != "VEHICLE") continue;

        VehicleFootprint footprint;
        if (!make_footprint(object, footprint)) {
            grid.perception_degraded = true;
            return false;
        }
        const std::uint8_t mask = radial_mask(footprint.nearest_distance_m,
                                             footprint.farthest_distance_m);
        if (mask == 0) continue;

        const auto sectors = covered_sectors(footprint);
        for (std::size_t sector = 0; sector < sectors.size(); ++sector) {
            if (!sectors[sector]) continue;
            candidate[sector].occupied = true;
            candidate[sector].subsector_mask = static_cast<std::uint8_t>(
                candidate[sector].subsector_mask | mask);
        }
    }
    grid.sectors = candidate;
    return true;
}

bool valid_steering_source(const RunnerScene& scene, bool fresh) {
    return fresh && !scene.ipc_faulted && scene.ego_valid &&
           scene.has_steering && scene.max_steering_deg &&
           std::isfinite(scene.steering_deg) &&
           std::isfinite(*scene.max_steering_deg) &&
           *scene.max_steering_deg > 0.0 &&
           std::abs(scene.steering_deg) <= *scene.max_steering_deg;
}

bool valid_speed_source(const RunnerScene& scene, bool fresh) {
    return fresh && !scene.ipc_faulted && scene.ego_valid &&
           scene.has_speed && std::isfinite(scene.longitudinal_speed_mps);
}

}  // namespace

CanSignalValues CanEncoder::encode(const std::optional<RunnerScene>& scene,
                                   std::uint64_t now_monotonic_ns) {
    CanSignalValues values;
    values.steering.alive_counter = advance_counter(steering_counter_);
    values.speed.alive_counter = advance_counter(speed_counter_);

    if (!scene) return values;
    const bool fresh = scene_is_fresh(*scene, now_monotonic_ns);

    if (valid_steering_source(*scene, fresh)) {
        values.steering.angle_deg = quantized_can_value(
            scene->steering_deg, kSteeringScaleDeg, kSteeringRawMin,
            kSteeringRawMax, values.steering.saturated);
        values.steering.valid = !values.steering.saturated;
    }

    if (valid_speed_source(*scene, fresh)) {
        values.speed.longitudinal_speed_mps = quantized_can_value(
            scene->longitudinal_speed_mps, kSpeedScaleMps, kSpeedRawMin,
            kSpeedRawMax, values.speed.saturated);
        values.speed.valid = !values.speed.saturated;
    }

    auto& grid = values.vehicle_object;
    grid.object_list_overflow = scene->objects_truncated;
    grid.perception_degraded = !scene->objects_valid ||
                               scene->objects_degraded ||
                               scene->objects_truncated;
    if (!fresh || scene->ipc_faulted || !scene->ego_valid ||
        !scene->objects_valid || scene->objects_degraded ||
        scene->objects_truncated) {
        return values;
    }

    grid.grid_valid = make_vehicle_grid(*scene, grid);
    if (!grid.grid_valid) {
        grid.sectors = {};
    }
    return values;
}

}  // namespace afs_bridge
