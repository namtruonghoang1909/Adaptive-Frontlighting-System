# System Architecture

The AFS/ADB prototype is a bench-scale hardware-in-the-loop lighting system. A Linux runtime
runs MetaDrive and host tools. A physical STM32F407VE-based AFS ECU receives CAN traffic and
moves the headlight rig.

## Core Components

| Component | Role |
|---|---|
| MetaDrive Simulation | Provides raw simulated ego state, lidar-like observations, and surrounding-vehicle data |
| MetaDrive CAN Bridge | Converts MetaDrive outputs into DBC-encoded CAN frames and sends them through SocketCAN/CAN adapter |
| STM32F407VE ECU Firmware | Receives CAN signals, decides final AFS/ADB behavior, drives hardware, and publishes status |

## Supporting Pieces

| Piece | Role |
|---|---|
| Dashboard | Lets the user request headlight modes and view decoded status |
| CAN bus | Shared physical link between Linux host tools and the AFS ECU |
| Headlight rig | Two assemblies with horizontal feedback swivel and seven LED beam zones per side |

## Data Flow

```text
MetaDrive Simulation
        |
        | raw ego/object simulator data
        v
MetaDrive CAN Bridge
        | extract ego/object data
        | filter/convert units
        | cantools encode
        | python-can send
        v
SocketCAN can0/vcan0 -> CAN adapter -> physical CAN bus
        |
        v
STM32F407VE ECU Firmware
        |
        +-- PCA9685 servo driver -> left/right feedback swivel servos
        +-- LED zone drivers ----> left/right LED beam zones
        +-- ADC inputs <--------- servo feedback wires
        |
        v
CAN status 0x100 -> Dashboard / logs
```

The MetaDrive CAN Bridge and Dashboard run in Linux. The AFS ECU is the only physical ECU.
The MetaDrive CAN Bridge should send processed object-level inputs for ADB, not raw lidar
arrays.

## ECU CAN Hardware

The STM32F407VE has CAN-capable peripherals with TX/RX pins. The bench needs a physical CAN
transceiver between those pins and CANH/CANL. Prefer a transceiver with 3.3 V logic support
for the STM32; a 5 V-only transceiver must be checked carefully for logic-level compatibility.

## Repository Orientation

```text
docs/
|-- architecture/
|   |-- overview.md
|   |-- data-pipeline.md
|   |-- workflow.md
|   |-- control-law.md
|   `-- components/
|       |-- afs-ecu.md
|       `-- dashboard.md
|-- can/
|-- agents/
|-- hardware/
|   |-- hardware.md
|   `-- visual.md
|-- simulation/
|-- tools/
|-- verification/
`-- temporary/
```

Project-owned source folders can be added later as the build takes shape.