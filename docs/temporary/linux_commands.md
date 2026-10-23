# Linux Command Reference For Embedded And Automotive Work

Practical shell commands for inspecting Linux hardware, bringing up SocketCAN,
monitoring traffic, debugging processes and sockets, and connecting to embedded
targets. Commands that change interface state or inject CAN traffic require
care on a live bus.

## Quick CAN Bring-Up

For this project, the CAN network is Classical CAN at 500 kbit/s. Confirm the
adapter driver has created an interface before configuring it:

```bash
lsusb
ip -brief link
ip -details link show can0
ethtool -i can0
```

Configure the physical adapter after replacing `can0` with its actual interface
name:

```bash
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000
sudo ip link set can0 up
ip -details -statistics link show can0
```

The ECU must use the same bitrate. Check interface state, CAN controller state,
and packet/error counters with `ip -details -statistics`. If the interface is
`BUS-OFF`, inspect bitrate, wiring, termination, and the other bus nodes before
trying a restart. A manual restart is:

```bash
sudo ip link set can0 type can restart
```

Some controllers support automatic restart after bus-off:

```bash
sudo ip link set can0 type can restart-ms 100
```

Automatic restart can help a bench test recover, but it does not diagnose or fix
the cause of bus errors.

## Discover USB Hardware And Drivers

```bash
lsusb                         # USB devices
lsusb -t                      # USB topology and driver bindings
ip -brief link                # Network interfaces, including SocketCAN
ethtool -i can0               # Driver and firmware details, when supported
lsmod | rg 'can|usb'          # Loaded CAN and USB kernel modules
modinfo can_raw               # Information about a kernel module
dmesg --follow                # Watch kernel messages while plugging hardware
journalctl -k -b              # Kernel messages from this boot
udevadm monitor --kernel --udev  # Watch device add/remove events
```

If a USB CAN adapter does not create a `can0`-style interface, check its Linux
driver and adapter documentation. The project bridge talks to SocketCAN; it does
not speak a vendor-specific USB protocol.

## Monitor And Exercise CAN

Monitor all traffic with timestamps and extra CAN metadata:

```bash
candump -tz -x can0
```

Filter for this project's standard message IDs:

```bash
candump -tz can0,100:7FF,200:7FF,300:7FF,400:7FF,500:7FF
```

Show decoded CAN error-frame details when the interface reports them:

```bash
candump -e -x can0
```

Save a text capture for later review:

```bash
candump -L can0 | tee can-capture.log
```

`cansend` sends a single frame. Use a virtual interface or isolated bench bus
for experiments. A real `0x400 Dashboard_Command` frame can change the ECU's
requested lighting state.

```bash
cansend vcan0 123#DEADBEEF
```

`cangen` generates traffic. Keep generated traffic on a virtual interface or a
bus deliberately set up for load testing:

```bash
cangen vcan0 -g 10
```

Estimate bus utilization on a physical or virtual interface:

```bash
canbusload can0@500000
```

## Create A Virtual CAN Interface

`vcan0` is useful for software tests without a physical adapter or ECU. It has
no physical bitrate setting:

```bash
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set vcan0 up
ip -details -statistics link show vcan0
```

In one terminal, listen:

```bash
candump -tz -x vcan0
```

In another, send a sample frame:

```bash
cansend vcan0 123#DEADBEEF
```

Remove the virtual interface when finished:

```bash
sudo ip link del vcan0
```

Run this project's optional SocketCAN integration test on a prepared `vcan0`:

```bash
cmake -S bridge -B build/bridge-vcan \
  -DAFS_ENABLE_SOCKETCAN_VCAN_TEST=ON
cmake --build build/bridge-vcan --parallel
ctest --test-dir build/bridge-vcan \
  -R socketcan_vcan_end_to_end --output-on-failure
```

## Start The Project CAN Path

Start a traffic monitor first, then run the bridge with CAN enabled:

```bash
candump -tz -x can0
bash bridge/scripts/run_runner_bridge.sh --can-interface can0
```

Start the other project processes in their own terminals:

```bash
bash dashboard/scripts/start_dashboard.sh
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

The bridge transmits `0x100` and `0x200` every 20 ms, `0x300` every 100 ms,
and `0x400` every 50 ms. It receives and validates ECU status on `0x500`. See
[CAN message details](../can/README.md) and [host CAN bring-up](../hardware/hardware.md#host-can-bring-up).

## Inspect Linux Sockets

The project has Unix domain sockets for runner-to-bridge and Dashboard-to-bridge
IPC. List local Unix sockets and their owning processes:

```bash
ss -xlpn
ss -xap
ss -xlpn | rg 'runner-bridge|dashboard-bridge'
sudo lsof -U
```

Inspect a process's file descriptors, replacing `<PID>` with its process ID:

```bash
ls -l /proc/<PID>/fd
```

`can0` is a network interface, not a filesystem socket. Use `candump` to inspect
CAN traffic; `ss -x` is for Unix domain sockets.

For TCP/IP services, inspect listening ports and established connections:

```bash
ss -ltnp
ss -tanp
```

## System And Kernel Diagnostics

```bash
uname -a                      # Kernel and machine architecture
cat /etc/os-release           # Linux distribution
ps -ef                        # Processes
pgrep -a afs_runner_bridge    # Find a named process
top                           # CPU and memory use
free -h                       # Memory summary
df -h                         # Filesystem space
lsblk -f                      # Block devices and filesystems
systemctl status <service>    # Service state
journalctl -u <service> -f    # Follow a service's logs
journalctl -k -b              # Kernel log for this boot
```

For a process that is stuck or misbehaving:

```bash
strace -f -e trace=socket,bind,setsockopt,poll,read,write -p <PID>
gdb -p <PID>
```

`strace` shows system calls such as socket creation and CAN reads/writes. Attach
debuggers only when appropriate for the target and running workload.

## Serial Consoles And Embedded Targets

Find stable USB serial device names and inspect the adapter that created them:

```bash
ls -l /dev/serial/by-id/
udevadm info --query=all --name=/dev/ttyUSB0
```

Connect to a target's UART console with `picocom` (replace the device and baud
rate with the board's settings):

```bash
picocom -b 115200 /dev/ttyUSB0
```

Connect to a Linux target and copy files:

```bash
ssh user@target-address
scp ./firmware.bin user@target-address:/tmp/
rsync -av ./build/ user@target-address:/tmp/build/
```

Check a binary's architecture and linked shared libraries:

```bash
file ./application
readelf -h ./application
ldd ./application
```

## Build And Inspect The Bridge

Configure a debug build, compile it, and run the registered tests:

```bash
cmake -S bridge -B build/bridge-debug -DCMAKE_BUILD_TYPE=Debug
cmake --build build/bridge-debug --parallel
ctest --test-dir build/bridge-debug --output-on-failure
```

Build output can show the exact compiler commands with:

```bash
cmake --build build/bridge-debug --verbose
```

## Install Common Tools

On Debian or Ubuntu, these packages provide many commands in this reference:

```bash
sudo apt update
sudo apt install can-utils ethtool iproute2 usbutils strace gdb picocom
```

Some commands require `sudo` to configure interfaces or inspect protected
kernel/process details. Use `man <command>` for the options installed on the
target distribution.
