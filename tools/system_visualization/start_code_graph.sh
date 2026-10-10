#!/usr/bin/env bash

# Serve the Code graph with working source-file links.
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    printf 'Usage: %s [port]\nDefault port: 8000\n' "$0"
    exit 0
fi

if (( $# > 1 )); then
    printf 'Usage: %s [port]\n' "$0" >&2
    exit 2
fi

port="${1:-8000}"
if [[ ! "$port" =~ ^[1-9][0-9]{0,4}$ ]] || (( port > 65535 )); then
    printf 'Port must be an integer from 1 to 65535.\n' >&2
    exit 2
fi

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

printf 'Open http://127.0.0.1:%s/tools/system_visualization/ in a browser.\n' "$port"
printf 'Press Ctrl+C to stop the server.\n'
exec python3 -m http.server "$port" --bind 127.0.0.1 --directory "$REPO_ROOT"
