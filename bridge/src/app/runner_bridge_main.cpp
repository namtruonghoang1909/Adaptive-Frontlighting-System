#include "afs_bridge/runner_ipc.hpp"
#include "afs_bridge/dashboard_ipc.hpp"

#include <cstdlib>
#include <exception>
#include <iostream>
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
    for (int index = 1; index < argc; index += 2) {
        if (index + 1 >= argc) {
            std::cerr << "usage: afs_runner_bridge [--socket PATH] [--dashboard-socket PATH]\n";
            return 2;
        }
        const std::string option = argv[index];
        if (option == "--socket") path = argv[index + 1];
        else if (option == "--dashboard-socket") dashboard_path = argv[index + 1];
        else {
            std::cerr << "usage: afs_runner_bridge [--socket PATH] [--dashboard-socket PATH]\n";
            return 2;
        }
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
        afs_bridge::DashboardIpcServer dashboard(dashboard_path, server);
        std::exception_ptr dashboard_error;
        std::thread dashboard_thread([&] {
            try { dashboard.run(); }
            catch (...) { dashboard_error = std::current_exception(); server.stop(); }
        });
        std::cout << "runner IPC listening at " << path << '\n';
        std::cout << "dashboard IPC listening at " << dashboard_path << '\n';
        try { server.run(); }
        catch (...) {
            dashboard.stop();
            dashboard_thread.join();
            throw;
        }
        dashboard.stop();
        dashboard_thread.join();
        if (dashboard_error) std::rethrow_exception(dashboard_error);
    } catch (const std::exception& error) {
        std::cerr << "bridge IPC error: " << error.what() << '\n';
        return 1;
    }
    return 0;
}
