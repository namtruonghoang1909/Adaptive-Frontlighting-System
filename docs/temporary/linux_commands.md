# Common Linux Network, USB, And CAN Commands

A short reference for checking network connectivity, open ports, USB devices,
and CAN interfaces. On Ubuntu, install any missing commands with:

```bash
sudo apt install iproute2 iputils-ping usbutils can-utils ethtool
```

## Network Interfaces And IP Addresses

```bash
ip -brief link                 # Interface names and link state
ip -brief address              # Interface IP addresses
ip route                       # Routing table and default gateway
hostname -I                    # This machine's assigned IP addresses
ping -c 4 <host-or-ip>         # Test reachability
```

## Listening Ports And Connections

```bash
ss -lntup                      # Listening TCP/UDP ports and owning processes
ss -ant                         # Active TCP connections
```

Use `sudo ss -lntup` to see process details for services owned by other users.

## USB Devices

```bash
lsusb                          # Connected USB devices
lsusb -t                        # USB tree and driver bindings
lsusb -d 0483:3748             # This project's detected ST-LINK/V2 ID
lsusb -d 1d50:606f             # This project's detected USB-CAN adapter ID
sudo dmesg --follow             # Watch kernel messages while plugging a device
```

USB IDs can differ between ST-Link models and firmware versions. `lsusb` showing
the probe confirms USB detection; it does not by itself confirm that the target
board is connected over SWD.

## SocketCAN Interface And Traffic

List interfaces and inspect a CAN interface's state, bitrate, and error counters:

```bash
ip -brief link
ip -details -statistics link show can0
ethtool -i can0                # Driver details, when supported
```

Bring up a CAN interface at this project's 500 kbit/s bitrate. Replace `can0`
with the interface name created for the adapter:

```bash
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000
sudo ip link set can0 up
```

Listen to all CAN frames, or filter for this project's message IDs:

```bash
candump -tz -x can0
candump -tz can0,100:7FF,200:7FF,300:7FF,400:7FF,500:7FF
```

`cansend` transmits a frame. Use a virtual CAN interface or an isolated bench
bus for experiments; a physical bus may contain active ECUs:

```bash
cansend vcan0 123#DEADBEEF
```

For a USB adapter-only check, controller loopback can test its SocketCAN
transmit/receive path without a second CAN node. The `gs_usb` adapter firmware
must advertise controller-loopback support; the kernel can driver exposes the
mode only when it is supported:

```bash
sudo ip link set can0 down && \
  sudo ip link set can0 type can bitrate 500000 loopback on && \
  sudo ip link set can0 up
```

Only after all three setup commands succeed, run `candump -tz -x can0` in one
terminal and `cansend can0 123#DEADBEEF` in another. If loopback is unsupported,
do not send the frame; restore normal mode with the standard bitrate commands.
Restore normal mode after a successful loopback test too:

```bash
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000 loopback off
sudo ip link set can0 up
```

Controller loopback does not prove that the adapter's physical transceiver or
CANH/CANL wiring works. Physical testing needs another active node to acknowledge
frames. SocketCAN also has local socket echo after successful transmission;
that echo alone is not a physical-bus test.

## Virtual CAN For Software Checks

`vcan0` lets software exchange CAN frames without a physical adapter or CAN
bus. It has no physical bitrate setting:

```bash
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set vcan0 up
```

Then listen and send from separate terminals:

```bash
candump -tz -x vcan0
cansend vcan0 123#DEADBEEF
```

Remove the virtual interface when finished:

```bash
sudo ip link del vcan0
```

For the project's CAN layouts and signal definitions, see the [CAN message
contract](../can/README.md). The [hardware guide](../hardware/hardware.md#host-can-bring-up)
contains the project-specific adapter bring-up steps.
