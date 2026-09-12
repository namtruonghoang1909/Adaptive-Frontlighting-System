# State

Future complete C++ snapshots for simulation input, Dashboard commands, decoded ECU status, and bridge health.

The main/IPC and CAN-worker threads will copy or replace snapshots under short mutex protection. Network I/O, parsing, encoding, and logging stay outside critical sections. Continuous observations use latest-state replacement; discrete actions use bounded identified work.
