#include "afs_bridge/can_frame_logger.hpp"

#include <exception>
#include <iostream>
#include <string>

int main(int argc, char** argv) {
    if (argc != 5 || std::string(argv[1]) != "--socket" ||
        std::string(argv[3]) != "--capture") {
        std::cerr << "usage: afs_can_frame_logger --socket PATH --capture JSONL\n";
        return 2;
    }

    try {
        return afs_bridge::CanFrameLogger{}.run(argv[2], argv[4]);
    } catch (const std::exception& error) {
        std::cerr << "CAN frame logger error: " << error.what() << '\n';
        return 1;
    }
}
