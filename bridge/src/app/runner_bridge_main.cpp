#include "afs_bridge/runner_ipc.hpp"
#include "afs_bridge/dashboard_ipc.hpp"
#include "afs_bridge/can_runtime.hpp"

#include <cstdlib>
#include <exception>
#include <iostream>
#include <memory>
#include <optional>
#include <string>
#include <thread>
#include <unistd.h>

int main(int argc, char** argv) {
    const char* runtime = std::getenv("XDG_RUNTIME_DIR");
    const std::string directory = runtime && runtime[0] != '\0'
        ? std::string(runtime) + "/afs"
        : "/tmp/afs-" + std::to_string(::getuid());
    const char* configured_runner = std::getenv("AFS_BRIDGE_SOCKET");
    std::string path = configured_runner && configured_runner[0] != '\0'
        ? configured_runner : directory + "/runner-bridge.sock";
    std::string dashboard_path;
    std::optional<std::string> can_interface;
    const auto usage = [] {
        std::cerr << "usage: afs_runner_bridge [--socket PATH] [--dashboard-socket PATH] "
                     "[--can-interface NAME]\n";
    };
    for (int index = 1; index < argc; ++index) {
        const std::string option = argv[index];
        if (option != "--socket" && option != "--dashboard-socket" &&
            option != "--can-interface") {
            usage();
            return 2;
        }
        if (index + 1 >= argc) {
            usage();
            return 2;
        }
        const std::string value = argv[++index];
        if (value.empty()) {
            usage();
            return 2;
        }
        if (option == "--socket") path = value;
        else if (option == "--dashboard-socket") dashboard_path = value;
        else can_interface = value;
    }
    const char* configured_dashboard = std::getenv("AFS_DASHBOARD_SOCKET");
    if (dashboard_path.empty()) dashboard_path = configured_dashboard && configured_dashboard[0] != '\0'
        ? configured_dashboard : directory + "/dashboard-bridge.sock";
    if (dashboard_path == path) {
        std::cerr << "runner and Dashboard socket paths must differ\n";
        return 2;
    }
    try {
        afs_bridge::RunnerIpcServer server(path);
        afs_bridge::DashboardIpcServer dashboard(
            dashboard_path, server, can_interface.has_value());
        std::unique_ptr<afs_bridge::CanRuntime> can_runtime;
        if (can_interface) {
            can_runtime = std::make_unique<afs_bridge::CanRuntime>(
                *can_interface, server, dashboard);
        }
        std::exception_ptr dashboard_error;
        std::exception_ptr can_error;
        std::thread dashboard_thread;
        std::thread can_thread;
        try {
            dashboard_thread = std::thread([&] {
                try { dashboard.run(); }
                catch (...) { dashboard_error = std::current_exception(); server.stop(); }
            });
            if (can_runtime) {
                can_thread = std::thread([&] {
                    try { can_runtime->run(); }
                    catch (...) { can_error = std::current_exception(); server.stop(); }
                });
            }
        } catch (...) {
            dashboard.stop();
            if (can_runtime) can_runtime->stop();
            if (dashboard_thread.joinable()) dashboard_thread.join();
            if (can_thread.joinable()) can_thread.join();
            throw;
        }
        std::cout << "runner IPC listening at " << path << '\n';
        std::cout << "dashboard IPC listening at " << dashboard_path << '\n';
        if (can_runtime) {
            std::cout << "SocketCAN bound to " << can_runtime->interface_name() << '\n';
        } else {
            std::cout << "SocketCAN disabled; pass --can-interface NAME to enable CAN I/O\n";
        }
        try { server.run(); }
        catch (...) {
            dashboard.stop();
            if (can_runtime) can_runtime->stop();
            dashboard_thread.join();
            if (can_thread.joinable()) can_thread.join();
            throw;
        }
        dashboard.stop();
        if (can_runtime) can_runtime->stop();
        dashboard_thread.join();
        if (can_thread.joinable()) can_thread.join();
        if (dashboard_error) std::rethrow_exception(dashboard_error);
        if (can_error) std::rethrow_exception(can_error);
    } catch (const std::exception& error) {
        std::cerr << "bridge runtime error: " << error.what() << '\n';
        return 1;
    }
    return 0;
}
