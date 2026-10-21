#pragma once

#include <string>

namespace afs_bridge {

// Diagnostic receiver that exercises the standalone CAN encoders against
// live runner IPC and logs representative in-memory frame batches.
class CanFrameLogger {
public:
    int run(const std::string& socket_path,
            const std::string& capture_path) const;
};

}  // namespace afs_bridge
