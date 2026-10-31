# CAN Errors And Troubleshooting

This page records host adapter, SocketCAN, and physical CAN-bus issues. The
project bitrate is 500 kbit/s. The short host setup is
`bash scripts/check.sh can-up`; the
full setup and hardware checks are in the [CAN interface guide](../hardware/can_interface.md).

## `can0` Is Missing Or `ethtool` Says “No Such Device”

**Observed symptom:** `ethtool -i can0` first returned `Cannot get driver
information: No such device`; later, Linux exposed `can0` with the `gs_usb`
driver.

Check USB enumeration, kernel interface creation, and the driver separately:

```bash
lsusb
ip -brief link
ip -details -statistics link show can0
ethtool -i can0
```

The adapter being visible in `lsusb` does not by itself mean that a SocketCAN
netdev exists. After the driver creates the interface, run
`bash scripts/check.sh can-up` to configure a down `can0` at 500 kbit/s
and bring it up. The script leaves an already-up interface unchanged.

## No Buffer Space Available On Bridge Transmit

**Observed symptom:** the bridge logged `CAN can0 transmit error: SocketCAN
transmit failed on can0: No buffer space available` during hardware testing.

This is a failed host transmit call (`ENOBUFS`): the kernel or adapter transmit
queue could not accept the frame at that moment. The message alone does not
identify whether the cause is a temporarily full queue, repeated unacknowledged
traffic, controller trouble, or another interface problem. Inspect the current
link state and error counters while the failure occurs:

```bash
ip -details -statistics link show can0
```

Stop the bridge before changing the interface. Confirm it is in normal mode at
500 kbit/s, the CANH/CANL wiring and termination are correct, and a second
powered CAN node is connected to acknowledge frames. A lone transmitting node
in normal mode cannot receive a CAN ACK. If the error recurs, preserve the full
bridge log and before/after `ip -details -statistics` output for diagnosis.

## `ERROR-PASSIVE`, Bus Errors, Or No Physical ACK

**Observed symptom:** `can0` was reported as `ERROR-PASSIVE` with bus-error and
arbitration counters increasing during hardware checks.

Check bitrate on every node, normal versus loopback mode, CANH-to-CANH and
CANL-to-CANL wiring, shared ground where the transceivers require it, bus-end
termination, and whether another active node is present to ACK. The adapter
being listed as `UP` and `LOWER_UP` confirms the host interface is active; it
does not prove that the physical bus is communicating correctly.

## `candump` Shows Matching `TX` And `RX` Frames But No ECU Response

**Observed symptom:** `candump -tz -x can0` showed matching host `TX` and `RX`
copies of test and bridge frames.

SocketCAN enables local loopback by default so other local sockets such as
`candump` can observe transmitted frames. A matching `TX`/`RX` pair is therefore
not by itself proof that a remote ECU received the frame; if the CAN controller
was explicitly configured for controller loopback, the frame may not have
traveled on CANH/CANL at all. Even in normal mode, distinguish a local echo from
a frame observed by a separate node. The Linux kernel explains the default
[SocketCAN local loopback behavior](https://docs.kernel.org/networking/can.html#local-loopback-of-sent-frames).
Physical verification requires normal mode, a separately connected active
CAN node, and a correctly terminated bus.
See [Test Adapter Controller Loopback](../hardware/can_interface.md#test-adapter-controller-loopback)
and [Verify The Physical CAN Bus](../hardware/can_interface.md#verify-the-physical-can-bus).

## SavvyCAN Opens But Shows No Frames

Starting the GUI does not attach it to `can0`. In SavvyCAN, create a **QT
SerialBus Devices → SocketCAN** connection and select the already-up interface;
then load `bridge/can/afs.dbc` in DBC File Manager. Loading a DBC only describes
how to decode frames; it does not create traffic. First confirm traffic with
`candump -tz -x can0`. See [the monitoring guide](../hardware/can_interface.md#inspect-frames-in-savvycan).
