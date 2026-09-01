# Data Flow

This page describes the data the system needs, how it moves over CAN, and what the
STM32F407VE ECU needs to control the physical headlights.

The project has three host-side runtime pieces: MetaDrive, Dashboard, and CAN Bridge. The CAN
Bridge is the only host-side module that sends or receives CAN frames.

## End-To-End Flow

```text
MetaDrive -> CAN Bridge reads -> CAN bus -> STM32F407VE AFS ECU
Dashboard -> CAN Bridge reads -> CAN bus -> STM32F407VE AFS ECU
STM32F407VE AFS ECU -> CAN bus -> CAN Bridge reads -> Dashboard
```

## Source Data

| Source | Provides | Consumed by | CAN result |
|---|---|---|---|
| MetaDrive | Ego steering state/input | CAN Bridge | `0x200 Vehicle_Steering` |
| MetaDrive | Ego speed | CAN Bridge | `0x300 Vehicle_Speed` |
| MetaDrive | Surrounding-vehicle position/presence | CAN Bridge | `0x310 Vehicle_Object` |
| Dashboard | Requested headlight power and mode | CAN Bridge | `0x400 Dashboard_Command` |
| Dashboard | Clear-fault request | CAN Bridge | `0x400 Dashboard_Command` |
| AFS ECU | Executed mode, faults, feedback, applied dim mask | CAN Bridge | `0x100 AFS_Status`, decoded and forwarded to Dashboard |

Dashboard command data is local HMI state until the CAN Bridge encodes it. The Dashboard does
not publish `0x400` directly.

## CAN Bridge Responsibility

Core bridge responsibilities:

1. Read requested headlight power, requested mode, and clear-fault request from the Dashboard.
2. Read required ego and surrounding-vehicle data from MetaDrive.
3. Convert simulator units and coordinate conventions into project signal conventions.
4. Publish steering and speed inputs for low-beam swivel.
5. Publish compact surrounding-object input for high-beam beam dodging.
6. Publish the Dashboard command frame.
7. Listen for `0x100 AFS_Status` from the ECU.
8. Decode accepted ECU status and update local status state for the Dashboard.

The bridge should not command servos or LEDs directly. It publishes inputs; the AFS ECU owns
the final lighting decision.

## CAN Transfer

Only compact signals cross CAN. The DBC will define exact packing, scaling, enums, alive
counters, and receiver validation rules.

| CAN ID | Message | Bus producer | Bus consumer | Dashboard visibility |
|---:|---|---|---|---|
| `0x200` | `Vehicle_Steering` | CAN Bridge | AFS ECU | Optional decoded bridge/log view |
| `0x300` | `Vehicle_Speed` | CAN Bridge | AFS ECU | Optional decoded bridge/log view |
| `0x310` | `Vehicle_Object` | CAN Bridge | AFS ECU | Optional decoded bridge/log view |
| `0x400` | `Dashboard_Command` | CAN Bridge | AFS ECU | Dashboard is logical command source |
| `0x100` | `AFS_Status` | AFS ECU | CAN Bridge | Main Dashboard status display |

`cantools` encodes signal dictionaries into CAN frame bytes. `python-can` sends and receives
those bytes on SocketCAN. `cantools` does not transmit frames by itself.

## CAN Receive Model

Each receiver should have its listener/filter ready for the desired CAN ID before normal
traffic starts.

```text
sender local data
  -> encode CAN frame
  -> transmit frame with ID, DLC, and data bytes
  -> receiver listener/filter accepts the desired ID
  -> receive_message validates ID, DLC, checksum, alive counter, reserved bits, and values
  -> receive_message decodes signals
  -> receive_message stores decoded values into local state variables
  -> control or display logic reads local state and checks freshness
```

The receive function stores data. It should not directly execute lighting behavior or UI
behavior.

## ECU Inputs

The STM32F407VE should receive only the signals needed for final lighting behavior:

| ECU input | Source message | Why the ECU needs it |
|---|---|---|
| Requested headlight power, requested mode, command validity, clear-fault request | `0x400 Dashboard_Command` | Turn headlights off/on, select requested behavior, and clear safe, clearable faults |
| Steering angle and freshness | `0x200 Vehicle_Steering` | Compute low-beam swivel behavior when requested |
| Vehicle speed and freshness | `0x300 Vehicle_Speed` | Gate behavior and scale swivel response |
| Surrounding-object validity and freshness | `0x310 Vehicle_Object` | Decide whether high-beam dimming input is usable |
| Surrounding-object data | `0x310 Vehicle_Object` | Support ADB behavior; detailed mapping logic is deferred to later implementation docs |
| Servo feedback ADC | Hardware | Confirm physical servo position |

## ECU Logic

The ECU owns final behavior. It should not trust the CAN Bridge or Dashboard to command
actuators directly.

```text
if Dashboard command is stale or invalid:
    execute Safe_Default
    center servos if controllable
    apply conservative low-beam output

else if requested headlight power is Off:
    execute Off
    command headlights off or standby

else if required CAN input for the requested mode is stale or invalid:
    execute Safe_Default
    center servos if controllable
    apply conservative low-beam output

else if requested mode is LowBeam_NoSwivel:
    center servos
    apply low-beam output

else if requested mode is LowBeam_Swivel:
    compute servo target from steering and speed
    command left/right swivel servos
    apply low-beam output

else if requested mode is HighBeam_NoDimming:
    center servos for first build
    apply high-beam output without adaptive dimming

else if requested mode is HighBeam_Dimming:
    center servos for first build
    apply high-beam output
    dim LED zones from accepted sector distances and glare thresholds

read servo feedback
report hardware/control faults and applied output on 0x100 AFS_Status
```

## Physical Outputs

| Output | Driver path | Used for |
|---|---|---|
| Left swivel servo | STM32 I2C -> servo PCA9685 -> servo PWM | Low-beam left headlight yaw |
| Right swivel servo | STM32 I2C -> servo PCA9685 -> servo PWM | Low-beam right headlight yaw |
| Left LED beam zones | STM32 I2C -> left beam PCA9685 -> LED zone driver/current limiting | Left high-beam output and dimming |
| Right LED beam zones | STM32 I2C -> right beam PCA9685 -> LED zone driver/current limiting | Right high-beam output and dimming |
| Status CAN frame | STM32 CAN -> MCP2551 -> CAN bus | CAN Bridge decode and Dashboard/log feedback |