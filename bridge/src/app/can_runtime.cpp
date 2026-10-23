#include "afs_bridge/can_runtime.hpp"

#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <string>
#include <thread>

namespace afs_bridge {
namespace {

using Clock = std::chrono::steady_clock;
constexpr auto kVehicleInputPeriod = std::chrono::milliseconds(20);
constexpr auto kVehicleObjectPeriod = std::chrono::milliseconds(100);
constexpr auto kDashboardCommandPeriod = std::chrono::milliseconds(50);
constexpr auto kIoErrorLogPeriod = std::chrono::seconds(1);
constexpr auto kStatusLogPeriod = std::chrono::seconds(1);
constexpr auto kIoErrorBackoff = std::chrono::milliseconds(10);

std::uint64_t monotonic_now_ns() {
    return static_cast<std::uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(
            Clock::now().time_since_epoch()).count());
}

std::chrono::milliseconds ceil_milliseconds(Clock::duration duration) {
    if (duration <= Clock::duration::zero()) return std::chrono::milliseconds(0);
    auto rounded = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
    if (rounded < duration) rounded += std::chrono::milliseconds(1);
    return rounded;
}

}  // namespace

CanRuntime::CanRuntime(std::string interface_name, const RunnerIpcServer& runner,
                       DashboardIpcServer& dashboard)
    : runner_(runner), dashboard_(dashboard),
      transport_(std::move(interface_name)) {}

void CanRuntime::stop() { stopping_.store(true); }

std::optional<AfsStatus> CanRuntime::latest_status() const {
    std::lock_guard<std::mutex> lock(status_lock_);
    return latest_status_;
}

std::string CanRuntime::interface_name() const { return transport_.interface_name(); }

void CanRuntime::report_io_error(const std::string& operation,
                                 const std::string& message) {
    static thread_local auto last_log = Clock::time_point::min();
    const auto now = Clock::now();
    if (last_log == Clock::time_point::min() || now - last_log >= kIoErrorLogPeriod) {
        std::cerr << "CAN " << transport_.interface_name() << ' ' << operation
                  << " error: " << message << '\n';
        last_log = now;
    }
}

void CanRuntime::report_status_rejection(const std::string& message) {
    static thread_local auto last_log = Clock::time_point::min();
    static thread_local std::string last_message;
    const auto now = Clock::now();
    if (message != last_message || last_log == Clock::time_point::min() ||
        now - last_log >= kIoErrorLogPeriod) {
        std::cerr << "CAN " << transport_.interface_name()
                  << " rejected AFS_Status: " << message << '\n';
        last_message = message;
        last_log = now;
    }
}

void CanRuntime::run() {
    auto next_vehicle_input = Clock::now();
    auto next_vehicle_object = next_vehicle_input;
    auto next_dashboard_command = next_vehicle_input;
    auto last_status_log = Clock::time_point::min();

    while (!stopping_.load()) {
        auto now = Clock::now();
        const bool vehicle_inputs_due = now >= next_vehicle_input;
        const bool vehicle_object_due = now >= next_vehicle_object;
        const bool dashboard_command_due = now >= next_dashboard_command;
        if (vehicle_inputs_due || vehicle_object_due || dashboard_command_due) {
            const auto transmit = [this](const CanFrame& frame) {
                if (stopping_.load()) return false;
                try {
                    transport_.send(frame);
                    return true;
                } catch (const std::exception& error) {
                    report_io_error("transmit", error.what());
                    return false;
                }
            };

            if (vehicle_inputs_due || vehicle_object_due) {
                const auto source = runner_.current_scene();
                const auto signals = can_encoder_.encode(source, monotonic_now_ns());
                const auto frames = frame_encoder_.encode(signals);
                if (vehicle_inputs_due) {
                    // CanFrameEncoder returns speed, steering, then object frames.
                    transmit(frames[0]);
                    transmit(frames[1]);
                }
                if (vehicle_object_due) transmit(frames[2]);
            }
            if (dashboard_command_due) {
                const auto command = dashboard_.command_snapshot();
                const DashboardCommandCanSignals command_signals{
                    dashboard_counter_, command.valid,
                    command.valid && command.clear_fault_pending,
                    command.valid && command.power_on,
                    command.valid ? command.mode_code : std::uint8_t{0},
                };
                const auto command_frame =
                    frame_encoder_.encode_dashboard_command(command_signals);
                if (transmit(command_frame) && command_signals.clear_fault_request) {
                    dashboard_.acknowledge_clear_fault(
                        command.clear_fault_generation);
                }
                dashboard_counter_ = static_cast<std::uint8_t>(
                    (dashboard_counter_ + 1U) & 0x0fU);
            }

            now = Clock::now();
            if (vehicle_inputs_due) {
                do {
                    next_vehicle_input += kVehicleInputPeriod;
                } while (next_vehicle_input <= now);
            }
            if (vehicle_object_due) {
                do {
                    next_vehicle_object += kVehicleObjectPeriod;
                } while (next_vehicle_object <= now);
            }
            if (dashboard_command_due) {
                do {
                    next_dashboard_command += kDashboardCommandPeriod;
                } while (next_dashboard_command <= now);
            }
        }

        const auto next_transmit = std::min(
            std::min(next_vehicle_input, next_vehicle_object),
            next_dashboard_command);
        const auto wait = ceil_milliseconds(next_transmit - Clock::now());
        try {
            const auto frame = transport_.receive(wait);
            if (!frame) continue;

            const auto received_ns = monotonic_now_ns();
            std::string rejection_reason;
            auto status = status_decoder_.decode(*frame, received_ns, rejection_reason);
            if (!status) {
                report_status_rejection(rejection_reason);
                continue;
            }

            {
                std::lock_guard<std::mutex> lock(status_lock_);
                latest_status_ = *status;
            }
            dashboard_.retain_ecu_status(*status);
            const auto received_at = Clock::now();
            if (last_status_log == Clock::time_point::min() ||
                received_at - last_status_log >= kStatusLogPeriod) {
                std::clog << "CAN " << transport_.interface_name()
                          << " accepted AFS_Status counter="
                          << static_cast<unsigned int>(status->alive_counter)
                          << " mode="
                          << static_cast<unsigned int>(status->executed_mode)
                          << " health="
                          << static_cast<unsigned int>(status->health_state)
                          << " dim_mask=0x" << std::hex
                          << status->applied_dim_sector_mask << std::dec << '\n';
                last_status_log = received_at;
            }
        } catch (const std::exception& error) {
            report_io_error("receive", error.what());
            const auto next_transmit = std::min(
                std::min(next_vehicle_input, next_vehicle_object),
                next_dashboard_command);
            const auto resume_at = std::min(next_transmit, Clock::now() + kIoErrorBackoff);
            std::this_thread::sleep_until(resume_at);
        }
    }
}

}  // namespace afs_bridge
