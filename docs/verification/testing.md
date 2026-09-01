# Verification Overview

This document gives a brief verification orientation. Concrete tests and pass/fail criteria
will be specified when build work starts.

## What Needs Confidence

| Area | What to verify |
|---|---|
| CAN contract | All tools decode the same DBC and message IDs |
| CAN Bridge | MetaDrive data is converted into expected CAN signals |
| Dashboard | Command state reaches the CAN Bridge and decoded ECU status is displayed correctly |
| CAN Bridge | Steering, speed, dashboard command, and object signals are published with expected units and timing |
| AFS ECU | Missing or invalid inputs lead to conservative behavior |
| Low-beam AFS | Servo swivel follows steering and speed limits correctly |
| High-beam ADB | LED zones dim around the relevant vehicle signal |
| Servo feedback | Commanded and measured angles match within calibrated tolerance |
| Hardware rig | Servos and lights move safely without binding, flicker, or power issues |
| Full HIL | Physical output follows the simulated vehicle and requested mode |

## Test Levels

| Level | Environment | Purpose |
|---|---|---|
| Unit | Host or firmware test environment | Isolated behavior checks |
| Virtual CAN | Linux `vcan0` | CAN message and host-tool checks without hardware |
| Synthetic CAN Bridge | CAN Bridge without MetaDrive | Known CAN values before simulator integration |
| Board bring-up | STM32F407VE and bench peripherals | Electrical and peripheral confidence |
| HIL | Real CAN and physical rig | End-to-end behavior |
| Demo acceptance | Full setup | Show the intended project behavior repeatably |

## Evidence To Keep Later

Useful evidence will include the DBC revision, CAN logs, Dashboard screenshots/logs, firmware
version, hardware notes, calibration notes, and observed physical behavior. Exact artifact
formats are future build details.