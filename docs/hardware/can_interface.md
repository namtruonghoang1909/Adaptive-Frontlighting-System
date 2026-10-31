# CAN Interface Setup and Hardware Tests

This guide prepares the USB-CAN adapter on the Linux host, checks the
SocketCAN path, and separates controller loopback from physical-bus testing.
Run commands from the repository root. The project's bus bitrate is
500 kbit/s. The user's adapter currently appears as `can0` with the `gs_usb`
driver. For the shared CAN check and interface bring-up commands, see the
[project scripts guide](../../scripts/dialogue.md).
For symptoms and diagnoses from adapter testing, see the
[CAN error log](../errors/can_errors.md).

## Detect and Configure the Adapter

Check that Linux enumerates the adapter and exposes its SocketCAN driver:

```bash
lsusb -d 1d50:606f
ip -details -statistics link show can0
ethtool -i can0
```

Use the project check command to configure the bitrate, then bring `can0` online:

```bash
bash scripts/check.sh can-up
ip -details -statistics link show can0
```

If the bitrate is already configured and the interface is only down, the
command to bring it up is:

```bash
sudo ip link set can0 up
```

The final `ip` output should show `UP` and normally `ERROR-ACTIVE`. The
interface must be up before the bridge or SavvyCAN can use it.

## Test Adapter Controller Loopback

Controller loopback checks the adapter's local SocketCAN send/receive path
without requiring a second CAN node. It does not test the physical transceiver
or CANH/CANL wiring. In one terminal, monitor the interface:

```bash
candump -tz -x can0
```

In another terminal, enable adapter controller loopback at 500 kbit/s:

```bash
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000 loopback on
sudo ip link set can0 up
```

Only if these commands succeed, send a test frame from another terminal:

```bash
cansend can0 123#DEADBEEF
```

`candump` should show ID `123` with data `DE AD BE EF`. The adapter passed
this check in the Ubuntu VM, showing a TX echo and a matching RX frame. If the
adapter does not support controller loopback, do not send the test frame; use
the normal-mode configuration instead. See the
[Linux SocketCAN documentation](https://docs.kernel.org/networking/can.html)
for local loopback and controller modes.

After the loopback test, return to normal bus mode:

```bash
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000 loopback off
sudo ip link set can0 up
```

## Check Bridge Transmission Through Loopback

With controller loopback enabled, monitor the bridge's transmit IDs:

```bash
candump -tz -x can0,100:7FF,200:7FF,300:7FF,400:7FF
```

In another terminal, start the bridge with CAN enabled:

```bash
bash scripts/start.sh bridge --can-interface can0
```

The monitor should show IDs `100`, `200`, `300`, and `400`. Without a runner
or Dashboard connected, validity and command fields remain cleared. This
checks SocketCAN writes through the adapter's controller path, not live input
values or ECU execution. Stop the bridge and `candump` when finished.

The user's adapter and bridge have passed this loopback check. The bridge also
reported `No buffer space available` during one run; check interface counters
and confirm the current interface mode if it recurs. A matching TX/RX echo
still does not prove physical bus communication.

## Verify the Physical CAN Bus

Physical testing requires normal bus mode, a powered second CAN node at
500 kbit/s to acknowledge frames, correct CANH/CANL wiring, and termination at
the bus ends. Do not send test frames on an unrelated live bus. Once the ECU
transceiver is wired and the CAN firmware is flashed, monitor traffic with:

```bash
candump -tz -x can0
```

Start the bridge with `bash scripts/start.sh bridge --can-interface can0` and
run the ECU. Confirm bridge messages `0x100`–`0x400` and ECU status `0x500`. The current firmware reports
`Safe_Default`; it does not drive the headlight actuators. See the
[STM32 build and flash guide](../../firmware/docs/stlink_build_flash.md) and
[hardware wiring overview](hardware.md).

## Inspect Frames in SavvyCAN

Start the optional GUI from the repository root:

```bash
bash scripts/start.sh savvycan
```

In SavvyCAN, create a **QT SerialBus Devices → SocketCAN** connection, select
`can0`, and load `bridge/can/afs.dbc` through **DBC File Manager**. The
interface must already be configured and up. SavvyCAN is separate from
`scripts/start.sh system`. For GUI navigation, see its [SocketCAN connection
guide](https://www.savvycan.com/docs/connectionwindow.html) and
[DBC manager guide](https://www.savvycan.com/docs/dbc_manager.html).
