#include "afs_bridge/runner_ipc.hpp"

#include <cstdlib>
#include <iostream>
#include <string>
#include <unistd.h>

int main(int argc, char** argv) {
    std::string path;
    if (argc == 3 && std::string(argv[1]) == "--socket") path = argv[2];
    else if (argc == 1) {
        const char* configured = std::getenv("AFS_BRIDGE_SOCKET");
        const char* runtime = std::getenv("XDG_RUNTIME_DIR");
        if (configured && configured[0] != '\0') path = configured;
        else if (runtime && runtime[0] != '\0') path = std::string(runtime) + "/afs/runner-bridge.sock";
        else path = "/tmp/afs-" + std::to_string(::getuid()) + "/runner-bridge.sock";
    } else {
        std::cerr << "usage: afs_runner_bridge [--socket PATH]\n";
        return 2;
    }
    try {
        afs_bridge::RunnerIpcServer server(path);
        std::cout << "runner IPC listening at " << path << '\n';
        server.run();
    } catch (const std::exception& error) {
        std::cerr << "runner IPC error: " << error.what() << '\n';
        return 1;
    }
    return 0;
}
