# System Architecture

The project is an Adaptive Front-lighting System prototype with two lighting behaviors:
low-beam AFS swivel and high-beam ADB beam dodging. It is a bench-scale
hardware-in-the-loop lighting system. A Linux runtime runs MetaDrive, Dashboard, CAN Bridge,
and host tools. A physical STM32F407VE-based AFS ECU receives CAN traffic and moves the
headlight rig.

## Core Components

| Component | Role |
|---|---|
| [MetaDrive Simulation](components/metadrive.md) | Provides simulated ego state, surrounding-vehicle data, and repeatable AFS/ADB scenarios |
| [Dashboard](components/dashboard.md) | Provides user command state and displays decoded ECU status through the CAN Bridge |
| [CAN Bridge](components/can-bridge.md) | Reads MetaDrive and Dashboard state, sends project CAN inputs, receives ECU status, and forwards decoded status |
| [STM32F407VE ECU Firmware](components/afs-ecu.md) | Receives CAN signals, decides final low-beam AFS and high-beam ADB behavior, drives hardware, and publishes status |
| [Headlight rig](components/headlights.md) | Two assemblies with horizontal feedback swivel and seven LED beam zones per side |

## Data Flow

```text
MetaDrive -> CAN Bridge reads -> CAN bus -> STM32F407VE AFS ECU
Dashboard -> CAN Bridge reads -> CAN bus -> STM32F407VE AFS ECU
STM32F407VE AFS ECU -> CAN bus -> CAN Bridge reads -> Dashboard
```

The Dashboard is not a CAN node in this design. It is an HMI module. The CAN Bridge owns
SocketCAN, DBC encode/decode, alive counters, checksums, DLC handling, and receive filters.

## Expanded Runtime Shape

```text
MetaDrive simulation
  ego steering/speed
  surrounding vehicles
        |
        v
CAN Bridge reads MetaDrive state --------+
                                         |
Dashboard HMI                            |
  requested headlight power/mode         |
  clear-fault request                    |
        |                                |
        v                                v
CAN Bridge reads Dashboard state -> encode/send 0x200, 0x300, 0x310, 0x400
        |
        v
SocketCAN can0/vcan0 -> CAN adapter -> physical CAN bus
        |
        v
STM32F407VE ECU Firmware
        |
        + servo PCA9685 board ----> left/right feedback swivel servos
        + left beam PCA9685 -----> left LED beam zones
        + right beam PCA9685 ----> right LED beam zones
        + ADC inputs <--------- servo feedback wires
        |
        v
0x100 AFS_Status -> CAN Bridge receive/decode -> Dashboard display / logs
```

The AFS ECU is the only physical ECU. The CAN Bridge should send compact surrounding-object inputs for ADB, not raw lidar arrays. Detailed ADB mapping logic will be documented later during implementation work.

## ECU CAN Hardware

The STM32F407VE has CAN-capable peripherals with TX/RX pins. The bench needs a physical CAN
transceiver between those pins and CANH/CANL. The current planned transceiver is MCP2551;
logic-level compatibility and wiring should be checked during hardware bring-up.