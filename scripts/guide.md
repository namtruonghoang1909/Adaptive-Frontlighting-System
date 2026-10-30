# Host Launcher Guide

Run these commands from the repository root in a graphical Linux session unless
the example explicitly uses headless mode. The scripts run the components in
the foreground: terminal output stays in the terminal where you launched them,
while the Dashboard and rendered MetaDrive open as separate windows.

## Start The Host System

```bash
bash scripts/start_system.sh
```

This starts three host processes:

```text
MetaDrive runner ── runner IPC ──> C++ bridge <── Dashboard IPC ── Dashboard
                                      │
                              optional SocketCAN
                                      │
                               can0 / ECU
```

By default, the bridge keeps runner and Dashboard IPC active but does not open
SocketCAN. To enable an already configured CAN interface:

```bash
bash scripts/start_system.sh --can-interface can0
```

The launcher does not create `can0`, set its bitrate, flash the STM32, or start
firmware. Configure the interface first using the
[host CAN bring-up guide](../docs/hardware/hardware.md#host-can-bring-up). Runner
options go after `--`; for example, this runs without the MetaDrive window for
100 steps:

```bash
bash scripts/start_system.sh -- --headless --max-steps 100
```

### What You Should See

- **Launcher terminal:** startup lines for the bridge, Dashboard, and runner.
  Bridge output reports its runner and Dashboard IPC sockets and says either
  `SocketCAN disabled` or `SocketCAN bound to can0`. Runner progress and errors
  are printed here too; output from all child processes can interleave.
- **Dashboard window:** live runner speed and steering when fresh runner data
  arrives, bridge connectivity and request status, and ECU CAN status when a
  valid `0x500` report arrives. Without ECU status, the Dashboard labels its
  simulated fallback/status as unavailable rather than proving ECU operation.
- **MetaDrive window:** the rendered driving scene. With `--headless`, this
  window is intentionally absent; use the runner's terminal progress or add
  `--scene-display` to open its optional browser scene view.
- **CAN monitor (when enabled):** run this in another terminal to inspect
  interface traffic:

  ```bash
  candump -tz -x can0
  ```

  The bridge sends `0x100` and `0x200` every 20 ms, `0x300` every 100 ms, and
  leased Dashboard `0x400` commands every 50 ms. A connected ECU with the CAN
  firmware flashed and wired can return `0x500` status every 50 ms. The current
  firmware reports `Safe_Default`; it does not drive the LED matrices or servos.

The system launcher stops its sibling host processes when one exits. Press
**Ctrl+C** in the launcher terminal to stop all three. It does not stop the STM32
or change CAN interface state.

## Start One Host Component

| Command | What it starts | Where to observe it |
|---|---|---|
| `bash scripts/start_bridge.sh` | Configures/builds the C++ bridge, then starts runner and Dashboard IPC receivers. | This terminal shows socket paths, accepted runner JSON, errors, and whether CAN is disabled. Add `--can-interface can0` to enable a configured CAN port. |
| `bash scripts/start_runner.sh` | Runs MetaDrive through the runner launcher; rendered mode is the default. | MetaDrive window plus runner progress/errors in this terminal. When the bridge is running, accepted scene JSON appears in the bridge terminal. Pass `--headless --max-steps 100` for a finite terminal-only run. |
| `bash scripts/start_dashboard.sh` | Opens the native Tkinter Dashboard. | Dashboard window. The bridge must also be running for live bridge/runner/ECU status. |
| `bash scripts/start_visualization.sh` | Starts the browser-based System Visualization development server. | Open the URL printed in the terminal, normally `http://127.0.0.1:8000/tools/system_visualization/`. This is a separate development viewer, not the native Dashboard and not the live AFS runtime. |

The same commands accept `--help` to show their options. Component-specific
runner and bridge details are in the [runner guide](../simulation_runner/runner.md)
and [bridge guide](../bridge/README.md).

## Inspect SocketCAN Traffic

First check that Linux sees the adapter as an active CAN interface:

```bash
ip -details -statistics link show can0
```

Then start the system with `--can-interface can0` and monitor it from another
terminal:

```bash
candump -tz -x can0
```

The bridge terminal should say `SocketCAN bound to can0`. The CAN monitor can
show the bridge's `0x100`–`0x400` transmissions and, if an ECU sends status,
`0x500`. Use the
[host CAN bring-up steps](../docs/hardware/hardware.md#host-can-bring-up) to
configure bitrate and verify adapter mode.

**A local CAN echo is not proof of physical CANH/CANL communication.** In
controller loopback or Linux local echo, a frame can appear as TX and RX on the
same adapter without reaching another node. To verify the physical bus, use
normal bus mode, a powered and correctly wired transceiver, matching bitrate,
proper bus termination, and a second active CAN node or ECU. Watch for bus-off
and error counters with `ip -details -statistics link show can0`.

## Frame-Encoder Smoke Script

To check runner-to-frame conversion and DBC encoding without using the adapter:

```bash
bash tests/can/bridge/frame_smoke/run_can_frame_smoke.sh
```

It runs a short headless simulation, prints representative frame bytes and
decoded values in the terminal, and reports whether the generated C codec and
`afs.dbc` agree. This is a software diagnostic; it does **not** open SocketCAN
or prove physical transmission. See the
[CAN test guide](../tests/README.md).

## Firmware Is Separate

`start_system.sh` does not build, flash, or start the STM32. Build and flash the
ECU with the scripts under `firmware/scripts/`, then observe its runtime messages
with the RTT reader. Follow the [firmware script guide](../firmware/scripts/guide.md)
for expected results and physical CAN checks.
