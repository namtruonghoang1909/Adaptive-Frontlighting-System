# Dashboard Component

The Dashboard is the user-facing host application for the prototype. It runs in Linux and
acts like a simple infotainment/debug screen.

## Responsibilities

- Let the user request a headlight mode.
- Send the requested mode on CAN `0x400`.
- Display AFS executed status from CAN `0x100`.
- Display steering and speed from CAN `0x200` and `0x300`.
- Display relevant ADB object input from CAN `0x310` when available.
- Help the developer see whether CAN messages are fresh and decoded correctly.

## Expected Modes

| Mode | Purpose |
|---|---|
| Low Beam Static | Centered conservative output |
| Low Beam AFS | Steering-linked horizontal swivel |
| High Beam | Full high-beam LED zones |
| High Beam ADB | High beam with object shadow zone |

## Boundary

The Dashboard does not execute lighting behavior. It asks for a mode; the AFS ECU decides
what is actually safe and reports that executed state back on `0x100`.

## Runtime

The Dashboard should run in the Linux SSH/runtime environment so it can use the same DBC,
SocketCAN interface, and CAN adapter as the MetaDrive CAN Bridge and other tools.