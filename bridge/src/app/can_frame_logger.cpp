#include "afs_bridge/can_frame_logger.hpp"

#include "afs.h"
#include "afs_bridge/can_encoder.hpp"
#include "afs_bridge/can_frame_encoder.hpp"
#include "afs_bridge/runner_ipc.hpp"

#include <array>
#include <chrono>
#include <cmath>
#include <exception>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <thread>

namespace afs_bridge {
namespace {

using Clock = std::chrono::steady_clock;
constexpr auto kFramePeriod = std::chrono::milliseconds(20);
constexpr auto kSceneTimeout = std::chrono::milliseconds(250);
constexpr auto kStartupTimeout = std::chrono::seconds(30);
constexpr double kRoundTripTolerance = 1e-6;

std::uint64_t monotonic_now_ns() {
    const auto elapsed = Clock::now().time_since_epoch();
    return static_cast<std::uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(elapsed).count());
}

std::string payload_hex(const CanFrame& frame) {
    std::ostringstream output;
    output << std::hex << std::setfill('0');
    for (std::size_t index = 0; index < frame.dlc; ++index) {
        if (index != 0) output << ' ';
        output << std::setw(2) << static_cast<unsigned int>(frame.data[index]);
    }
    return output.str();
}

std::string compact_payload_hex(const CanFrame& frame) {
    std::ostringstream output;
    output << std::hex << std::setfill('0');
    for (std::size_t index = 0; index < frame.dlc; ++index) {
        output << std::setw(2) << static_cast<unsigned int>(frame.data[index]);
    }
    return output.str();
}

std::string expected_speed_json(const SpeedCanSignals& signals) {
    std::ostringstream output;
    output << std::setprecision(17)
           << "{\"AliveCounter\":"
           << static_cast<unsigned int>(signals.alive_counter)
           << ",\"SpeedValid\":" << static_cast<unsigned int>(signals.valid)
           << ",\"SpeedSaturated\":"
           << static_cast<unsigned int>(signals.saturated)
           << ",\"LongitudinalSpeedMps\":"
           << signals.longitudinal_speed_mps << '}';
    return output.str();
}

std::string expected_steering_json(const SteeringCanSignals& signals) {
    std::ostringstream output;
    output << std::setprecision(17)
           << "{\"AliveCounter\":"
           << static_cast<unsigned int>(signals.alive_counter)
           << ",\"SteeringValid\":"
           << static_cast<unsigned int>(signals.valid)
           << ",\"SteeringSaturated\":"
           << static_cast<unsigned int>(signals.saturated)
           << ",\"SteeringAngleDeg\":" << signals.angle_deg << '}';
    return output.str();
}

std::string expected_vehicle_object_json(
    const VehicleObjectCanSignals& signals) {
    std::ostringstream output;
    output << "{\"GridValid\":"
           << static_cast<unsigned int>(signals.grid_valid)
           << ",\"PerceptionDegraded\":"
           << static_cast<unsigned int>(signals.perception_degraded)
           << ",\"ObjectListOverflow\":"
           << static_cast<unsigned int>(signals.object_list_overflow);
    for (std::size_t sector = 0; sector < signals.sectors.size(); ++sector) {
        output << ",\"Sector" << std::setw(2) << std::setfill('0') << sector
               << "Occupied\":"
               << static_cast<unsigned int>(signals.sectors[sector].occupied)
               << ",\"Sector" << std::setw(2) << sector
               << "SubsectorMask\":"
               << static_cast<unsigned int>(signals.sectors[sector].subsector_mask);
    }
    output << '}';
    return output.str();
}

void capture_frame(std::ostream& capture, const CanFrame& frame,
                   const std::string& expected_json) {
    capture << "{\"can_id\":" << frame.can_id
            << ",\"dlc\":" << static_cast<unsigned int>(frame.dlc)
            << ",\"data\":\"" << compact_payload_hex(frame)
            << "\",\"expected\":" << expected_json << "}\n";
}

void require(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}

void verify_frame_header(const CanFrame& frame, std::uint32_t expected_id,
                         std::uint8_t expected_dlc) {
    require(frame.can_id == expected_id, "frame ID does not match DBC");
    require(frame.dlc == expected_dlc, "frame DLC does not match DBC");
}

struct DecodedBatch {
    afs_vehicle_speed_t speed{};
    afs_vehicle_steering_t steering{};
    afs_vehicle_object_t vehicle_object{};
};

DecodedBatch decode_and_verify(
    const std::array<CanFrame, kCanFrameBatchSize>& frames,
    const CanSignalValues& expected) {
    verify_frame_header(frames[0], AFS_VEHICLE_SPEED_FRAME_ID,
                        AFS_VEHICLE_SPEED_LENGTH);
    verify_frame_header(frames[1], AFS_VEHICLE_STEERING_FRAME_ID,
                        AFS_VEHICLE_STEERING_LENGTH);
    verify_frame_header(frames[2], AFS_VEHICLE_OBJECT_FRAME_ID,
                        AFS_VEHICLE_OBJECT_LENGTH);

    DecodedBatch decoded;
    require(afs_vehicle_speed_unpack(&decoded.speed, frames[0].data.data(),
                                     frames[0].dlc) == 0,
            "DBC could not decode Vehicle_Speed");
    require(afs_vehicle_steering_unpack(&decoded.steering,
                                        frames[1].data.data(), frames[1].dlc) == 0,
            "DBC could not decode Vehicle_Steering");
    require(afs_vehicle_object_unpack(&decoded.vehicle_object,
                                      frames[2].data.data(), frames[2].dlc) == 0,
            "DBC could not decode Vehicle_Object");

    require(decoded.speed.alive_counter == expected.speed.alive_counter &&
                decoded.speed.speed_valid == expected.speed.valid &&
                decoded.speed.speed_saturated == expected.speed.saturated &&
                std::abs(afs_vehicle_speed_longitudinal_speed_mps_decode(
                             decoded.speed.longitudinal_speed_mps) -
                         expected.speed.longitudinal_speed_mps) <=
                    kRoundTripTolerance,
            "Vehicle_Speed decoded signals differ from encoder input");
    require(decoded.speed.speed_reserved_bits6_7 == 0 &&
                decoded.speed.speed_reserved_byte3 == 0 &&
                decoded.speed.speed_reserved_bytes4_to6 == 0 &&
                decoded.speed.speed_reserved_byte7 == 0,
            "Vehicle_Speed reserved signals are not zero");

    require(decoded.steering.alive_counter == expected.steering.alive_counter &&
                decoded.steering.steering_valid == expected.steering.valid &&
                decoded.steering.steering_saturated == expected.steering.saturated &&
                std::abs(afs_vehicle_steering_steering_angle_deg_decode(
                             decoded.steering.steering_angle_deg) -
                         expected.steering.angle_deg) <= kRoundTripTolerance,
            "Vehicle_Steering decoded signals differ from encoder input");
    require(decoded.steering.steering_reserved_bits6_7 == 0 &&
                decoded.steering.steering_reserved_byte3 == 0 &&
                decoded.steering.steering_reserved_bytes4_to6 == 0 &&
                decoded.steering.steering_reserved_byte7 == 0,
            "Vehicle_Steering reserved signals are not zero");

    const auto& object = decoded.vehicle_object;
    require(object.grid_valid == expected.vehicle_object.grid_valid &&
                object.perception_degraded ==
                    expected.vehicle_object.perception_degraded &&
                object.object_list_overflow ==
                    expected.vehicle_object.object_list_overflow,
            "Vehicle_Object quality signals differ from encoder input");
    require(object.object_reserved_byte0 == 0 &&
                object.object_reserved_bits61_63 == 0,
            "Vehicle_Object reserved signals are not zero");

    const std::array<std::uint8_t, kVehicleSectorCount> occupied{
        object.sector00_occupied, object.sector01_occupied,
        object.sector02_occupied, object.sector03_occupied,
        object.sector04_occupied, object.sector05_occupied,
        object.sector06_occupied, object.sector07_occupied,
        object.sector08_occupied, object.sector09_occupied};
    const std::array<std::uint8_t, kVehicleSectorCount> masks{
        object.sector00_subsector_mask, object.sector01_subsector_mask,
        object.sector02_subsector_mask, object.sector03_subsector_mask,
        object.sector04_subsector_mask, object.sector05_subsector_mask,
        object.sector06_subsector_mask, object.sector07_subsector_mask,
        object.sector08_subsector_mask, object.sector09_subsector_mask};
    for (std::size_t sector = 0; sector < kVehicleSectorCount; ++sector) {
        require(occupied[sector] == expected.vehicle_object.sectors[sector].occupied &&
                    masks[sector] ==
                        expected.vehicle_object.sectors[sector].subsector_mask,
                "Vehicle_Object sector differs from encoder input");
    }
    return decoded;
}

void log_batch(std::uint64_t cycle, const std::optional<RunnerScene>& scene,
               const CanSignalValues& signals,
               const std::array<CanFrame, kCanFrameBatchSize>& frames,
               const DecodedBatch& decoded) {
    std::cout << std::fixed << std::setprecision(2)
              << "cycle=" << cycle;
    if (scene) {
        std::cout << " seq=" << scene->sequence << " source=" << scene->source
                  << " input{steering=" << scene->steering_deg << "deg"
                  << " speed=" << scene->longitudinal_speed_mps << "m/s}"
                  << " signals{steering=" << signals.steering.angle_deg << "deg"
                  << ", speed=" << signals.speed.longitudinal_speed_mps << "m/s"
                  << ", grid_valid=" << signals.vehicle_object.grid_valid << '}';
    } else {
        std::cout << " seq=none source=unavailable"
                  << " signals{steering_valid=0,speed_valid=0,grid_valid=0}";
    }

    std::cout << " | 0x100/" << static_cast<unsigned int>(frames[0].dlc)
              << " [" << payload_hex(frames[0]) << "] decoded{counter="
              << static_cast<unsigned int>(decoded.speed.alive_counter)
              << ", valid=" << static_cast<unsigned int>(decoded.speed.speed_valid)
              << ", saturated="
              << static_cast<unsigned int>(decoded.speed.speed_saturated)
              << ", speed="
              << afs_vehicle_speed_longitudinal_speed_mps_decode(
                     decoded.speed.longitudinal_speed_mps)
              << "m/s}"
              << " | 0x200/" << static_cast<unsigned int>(frames[1].dlc)
              << " [" << payload_hex(frames[1]) << "] decoded{counter="
              << static_cast<unsigned int>(decoded.steering.alive_counter)
              << ", valid="
              << static_cast<unsigned int>(decoded.steering.steering_valid)
              << ", saturated="
              << static_cast<unsigned int>(decoded.steering.steering_saturated)
              << ", angle="
              << afs_vehicle_steering_steering_angle_deg_decode(
                     decoded.steering.steering_angle_deg)
              << "deg}"
              << " | 0x300/" << static_cast<unsigned int>(frames[2].dlc)
              << " [" << payload_hex(frames[2]) << "] decoded{valid="
              << static_cast<unsigned int>(decoded.vehicle_object.grid_valid)
              << ", degraded=" << static_cast<unsigned int>(
                     decoded.vehicle_object.perception_degraded)
              << ", overflow=" << static_cast<unsigned int>(
                     decoded.vehicle_object.object_list_overflow)
              << ", sectors=";

    const std::array<std::uint8_t, kVehicleSectorCount> occupied{
        decoded.vehicle_object.sector00_occupied,
        decoded.vehicle_object.sector01_occupied,
        decoded.vehicle_object.sector02_occupied,
        decoded.vehicle_object.sector03_occupied,
        decoded.vehicle_object.sector04_occupied,
        decoded.vehicle_object.sector05_occupied,
        decoded.vehicle_object.sector06_occupied,
        decoded.vehicle_object.sector07_occupied,
        decoded.vehicle_object.sector08_occupied,
        decoded.vehicle_object.sector09_occupied};
    const std::array<std::uint8_t, kVehicleSectorCount> masks{
        decoded.vehicle_object.sector00_subsector_mask,
        decoded.vehicle_object.sector01_subsector_mask,
        decoded.vehicle_object.sector02_subsector_mask,
        decoded.vehicle_object.sector03_subsector_mask,
        decoded.vehicle_object.sector04_subsector_mask,
        decoded.vehicle_object.sector05_subsector_mask,
        decoded.vehicle_object.sector06_subsector_mask,
        decoded.vehicle_object.sector07_subsector_mask,
        decoded.vehicle_object.sector08_subsector_mask,
        decoded.vehicle_object.sector09_subsector_mask};
    for (std::size_t sector = 0; sector < kVehicleSectorCount; ++sector) {
        if (sector != 0) std::cout << ',';
        std::cout << static_cast<unsigned int>(sector) << ':'
                  << static_cast<unsigned int>(occupied[sector]) << '/'
                  << static_cast<unsigned int>(masks[sector]);
    }
    std::cout << "}} roundtrip=PASS\n" << std::flush;
}

}  // namespace

int CanFrameLogger::run(const std::string& socket_path,
                        const std::string& capture_path) const {
    std::ofstream capture(capture_path, std::ios::out | std::ios::trunc);
    if (!capture) throw std::runtime_error("could not open JSONL frame capture");
    RunnerIpcServer server(socket_path, false);
    std::exception_ptr receiver_error;
    std::mutex receiver_error_lock;
    std::thread receiver([&] {
        try {
            server.run();
        } catch (...) {
            std::lock_guard<std::mutex> lock(receiver_error_lock);
            receiver_error = std::current_exception();
        }
    });

    const auto stop_receiver = [&] {
        server.stop();
        if (receiver.joinable()) receiver.join();
    };
    const auto check_receiver = [&] {
        std::lock_guard<std::mutex> lock(receiver_error_lock);
        if (receiver_error) std::rethrow_exception(receiver_error);
    };

    try {
        CanEncoder signal_encoder;
        CanFrameEncoder frame_encoder;
        const auto startup_deadline = Clock::now() + kStartupTimeout;
        std::optional<Clock::time_point> next_cycle;
        std::optional<Clock::time_point> disconnected_at;
        bool received_scene = false;
        bool logged_unavailable = false;
        std::uint64_t cycle = 0;
        std::uint64_t logged_batches = 0;
        std::uint64_t unique_scenes = 0;
        std::optional<std::uint64_t> last_sequence;
        std::optional<std::uint64_t> last_logged_sequence;

        while (true) {
            check_receiver();
            const auto loop_now = Clock::now();
            std::optional<RunnerScene> scene;
            if (server.has_scene()) {
                scene = server.latest_scene();
                received_scene = true;
                disconnected_at.reset();
                if (!last_sequence || *last_sequence != scene->sequence) {
                    ++unique_scenes;
                    last_sequence = scene->sequence;
                }
            } else if (!received_scene) {
                if (loop_now >= startup_deadline) {
                    throw std::runtime_error(
                        "no runner scene arrived before the startup timeout");
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
                continue;
            } else {
                if (!disconnected_at) disconnected_at = loop_now;
                if (loop_now - *disconnected_at >= kSceneTimeout) break;
            }

            if (!next_cycle) next_cycle = loop_now;
            if (loop_now > *next_cycle) next_cycle = loop_now;
            const auto now_ns = monotonic_now_ns();
            const auto signals = signal_encoder.encode(scene, now_ns);
            const auto frames = frame_encoder.encode(signals);
            const auto decoded = decode_and_verify(frames, signals);
            ++cycle;

            capture_frame(capture, frames[0], expected_speed_json(signals.speed));
            capture_frame(capture, frames[1],
                          expected_steering_json(signals.steering));
            capture_frame(capture, frames[2],
                          expected_vehicle_object_json(signals.vehicle_object));
            capture.flush();
            if (!capture) throw std::runtime_error("could not write JSONL frame capture");

            const bool new_scene = scene &&
                (!last_logged_sequence || *last_logged_sequence != scene->sequence);
            const bool first_unavailable_cycle = !scene && !logged_unavailable;
            const bool counter_rollover = signals.speed.alive_counter == 0;
            if (new_scene || first_unavailable_cycle || counter_rollover) {
                log_batch(cycle, scene, signals, frames, decoded);
                ++logged_batches;
                if (scene) last_logged_sequence = scene->sequence;
                else logged_unavailable = true;
            }

            *next_cycle += kFramePeriod;
            std::this_thread::sleep_until(*next_cycle);
        }

        stop_receiver();
        check_receiver();
        if (cycle == 0) throw std::runtime_error("no frame batches were encoded");
        std::cout << "DBC round-trip passed for " << cycle << " scheduled frame batches ("
                  << cycle * kCanFrameBatchSize << " frames) from " << unique_scenes
                  << " MetaDrive scenes; logged " << logged_batches
                  << " representative batches.\n";
        return 0;
    } catch (...) {
        stop_receiver();
        throw;
    }
}

}  // namespace afs_bridge
