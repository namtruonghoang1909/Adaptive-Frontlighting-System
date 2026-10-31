# Application UI

`window.py` opens a native Tkinter Dashboard with a top surrounding view,
middle speed/steering gauges and lighting selection preview, and bottom driver
controls. The top view uses fresh runner vehicles or labeled simulated fallback.
In the ADB preview, the high-beam fan omits a sector around a sample vehicle;
the road remains visible through the unlit gap. The low-beam base stays lit.
The power switch disables mode buttons when off. Local
selection updates the preview immediately; mode, power, and clear-fault
controls also call `GatewayDashboardState` to request bridge actions. A second
native window shows detailed ego and ECU values. Mouse wheels and trackpads
scroll the Dashboard when its contents exceed the window height. Source labels
distinguish decoded ECU status and freshness from simulated fallback values.
