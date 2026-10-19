#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly REQUESTED_BUILD_DIR="${AFS_BRIDGE_BUILD_DIR:-$REPO_ROOT/build/bridge}"
readonly BUILD_TYPE="${AFS_BRIDGE_BUILD_TYPE:-Release}"

if [[ "$REQUESTED_BUILD_DIR" == /* ]]; then
    readonly BUILD_DIR="$REQUESTED_BUILD_DIR"
else
    readonly BUILD_DIR="$REPO_ROOT/$REQUESTED_BUILD_DIR"
fi

cmake -S "$REPO_ROOT/bridge" -B "$BUILD_DIR" \
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE"
cmake --build "$BUILD_DIR" --target afs_runner_bridge --parallel

exec "$BUILD_DIR/afs_runner_bridge" "$@"
