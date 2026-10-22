"""Native AFS instrument cluster with bridge IPC and simulated ECU values."""

from __future__ import annotations

import argparse
import math
import sys
from typing import Any

from afs_dashboard.gateway_client.client import GatewayDashboardState
from afs_dashboard.models.state import MODE_LABELS


tk: Any = None

BG = "#090e15"
PANEL = "#101b26"
PANEL_LIGHT = "#172633"
BORDER = "#304554"
TEXT = "#eaf2f5"
MUTED = "#9bb0bc"
DIM = "#68808e"
CYAN = "#6ed6eb"
AMBER = "#f2ba67"
GREEN = "#79d5a6"
RED = "#ef8a7d"

MODE_BUTTONS = (
    ("low_beam_no_swivel", "◕  LOW BEAM\nFixed aim"),
    ("low_beam_swivel", "↗  LOW BEAM\nAdaptive swivel"),
    ("high_beam_no_dimming", "☼  HIGH BEAM\nFull output"),
    ("high_beam_dimming", "✳  HIGH BEAM\nADB dimming"),
)


def _label(parent: Any, text: str, size: int = 10, color: str = TEXT,
           bold: bool = False, background: str = BG, **kwargs: Any) -> Any:
    return tk.Label(
        parent, text=text, fg=color, bg=background,
        font=("DejaVu Sans", size, "bold" if bold else "normal"),
        anchor="w", **kwargs,
    )


class DashboardWindow:
    """Draws the car-style cluster and sends commands through the gateway client."""

    def __init__(self, root: Any, state: GatewayDashboardState) -> None:
        self.root = root
        self.state = state
        self.snapshot = state.snapshot()
        self.selected_power = self.snapshot["request"]["power_on"]
        self.selected_mode = self.snapshot["request"]["mode"]
        self._selection_touched = False
        self.details_window: Any = None
        self.detail_values: dict[str, Any] = {}
        root.title("AFS Vehicle Dashboard")
        root.configure(bg=BG)
        root.geometry("1240x980")
        root.minsize(900, 650)
        scroll = tk.Canvas(root, bg=BG, bd=0, highlightthickness=0,
                           yscrollincrement=16)
        scrollbar = tk.Scrollbar(root, orient="vertical", command=scroll.yview)
        scrollbar.pack(side="right", fill="y")
        scroll.pack(side="left", fill="both", expand=True)
        scroll.configure(yscrollcommand=scrollbar.set)
        self.scroll_canvas = scroll
        root.bind_all("<MouseWheel>", self._scroll_with_pointer, add="+")
        root.bind_all("<Button-4>", self._scroll_with_pointer, add="+")
        root.bind_all("<Button-5>", self._scroll_with_pointer, add="+")
        body = tk.Frame(scroll, bg=BG)
        body_id = scroll.create_window((0, 0), window=body, anchor="nw")
        body.bind("<Configure>", lambda _event: scroll.configure(scrollregion=scroll.bbox("all")))
        scroll.bind("<Configure>", lambda event: scroll.itemconfigure(body_id, width=event.width))

        topbar = tk.Frame(body, bg=BG, padx=28, pady=16)
        topbar.pack(fill="x")
        _label(topbar, "A", 22, CYAN, True).pack(side="left")
        brand = tk.Frame(topbar, bg=BG, padx=13)
        brand.pack(side="left")
        _label(brand, "AFS", 13, TEXT, True).pack(anchor="w")
        _label(brand, "ADAPTIVE FRONT LIGHTING", 8, DIM, True).pack(anchor="w")
        self.header_status = _label(topbar, "DEMO ECU  ·  BRIDGE OFFLINE", 9, AMBER, True)
        self.header_status.pack(side="right")

        surround = tk.Frame(body, bg=PANEL, padx=18, pady=13,
                            highlightbackground=BORDER, highlightthickness=1)
        surround.pack(fill="x", padx=28, pady=(5, 14))
        _label(surround, "01  SURROUNDING OBJECTS", 10, CYAN, True, PANEL).pack(anchor="w")
        self.surround_source_label = _label(surround, "Top-down proximity view · simulated object positions",
                                            9, MUTED, False, PANEL)
        self.surround_source_label.pack(anchor="w", pady=(3, 8))
        self.surround_canvas = tk.Canvas(surround, height=220, bg="#0b1620", bd=0,
                                         highlightthickness=0)
        self.surround_canvas.pack(fill="x")
        self.surround_canvas.bind("<Configure>", lambda _event: self._draw_surround())

        self.cluster = tk.Canvas(body, height=390, bg=PANEL, bd=0, highlightthickness=1,
                                 highlightbackground=BORDER)
        self.cluster.pack(fill="x", padx=28, pady=(0, 14))
        self.cluster.bind("<Configure>", lambda _event: self._draw_cluster())

        controls = tk.Frame(body, bg=PANEL, padx=20, pady=16,
                            highlightbackground=BORDER, highlightthickness=1)
        controls.pack(fill="x", padx=28)
        control_header = tk.Frame(controls, bg=PANEL)
        control_header.pack(fill="x", pady=(0, 14))
        title = tk.Frame(control_header, bg=PANEL)
        title.pack(side="left")
        _label(title, "03  DRIVER CONTROLS", 9, CYAN, True, PANEL).pack(anchor="w")
        _label(title, "Choose headlight mode", 16, TEXT, True, PANEL).pack(anchor="w", pady=(3, 0))
        self.power_button = tk.Button(control_header, command=self._toggle_power,
                                      font=("DejaVu Sans", 10, "bold"), relief="flat",
                                      bd=0, padx=18, pady=10, cursor="hand2")
        self.power_button.pack(side="right")

        modes = tk.Frame(controls, bg=PANEL)
        modes.pack(fill="x")
        self.mode_buttons: dict[str, Any] = {}
        for column, (mode, label) in enumerate(MODE_BUTTONS):
            modes.grid_columnconfigure(column, weight=1, uniform="modes")
            button = tk.Button(
                modes, text=label, command=lambda selected=mode: self._select_mode(selected),
                font=("DejaVu Sans", 10, "bold"), justify="left", anchor="w",
                relief="flat", bd=0, padx=17, pady=13, cursor="hand2",
            )
            button.grid(row=0, column=column, sticky="ew", padx=(0 if column == 0 else 5,
                                                                    0 if column == 3 else 5))
            self.mode_buttons[mode] = button

        result_row = tk.Frame(controls, bg=PANEL)
        result_row.pack(fill="x", pady=(14, 0))
        self.result_label = _label(result_row, "", 9, MUTED, False, PANEL)
        self.result_label.pack(side="left")
        self.request_id_label = _label(result_row, "", 9, DIM, True, PANEL)
        self.request_id_label.pack(side="right")

        status = tk.Frame(controls, bg=PANEL)
        status.pack(fill="x", pady=(16, 4))
        for column in range(3):
            status.grid_columnconfigure(column, weight=1, uniform="status")
        self.status_labels: dict[str, Any] = {}
        cards = (
            ("health", "ECU HEALTH · SIMULATED"),
            ("requested", "SELECTED MODE · PREVIEW"),
            ("bridge", "BRIDGE LINK"),
        )
        for column, (name, caption) in enumerate(cards):
            card = tk.Frame(status, bg=PANEL, padx=18, pady=12,
                            highlightbackground=BORDER, highlightthickness=1)
            card.grid(row=0, column=column, sticky="nsew", padx=(0 if column == 0 else 5,
                                                                   0 if column == 2 else 5))
            _label(card, caption, 8, DIM, True, PANEL).pack(anchor="w")
            self.status_labels[name] = _label(card, "", 14, TEXT, True, PANEL)
            self.status_labels[name].pack(anchor="w", pady=(5, 3))
            footer_text = {
                "health": "Simulated ECU status",
                "requested": "Bridge acceptance shown above",
                "bridge": "ECU CAN status unavailable",
            }[name]
            _label(card, footer_text,
                   9, MUTED, False, PANEL).pack(anchor="w")

        footer = tk.Frame(controls, bg=PANEL)
        footer.pack(fill="x", pady=(12, 0))
        tk.Button(footer, text="Open detailed status  ›", command=self._open_details,
                  bg=PANEL_LIGHT, fg=CYAN, activebackground="#284354",
                  activeforeground=TEXT, relief="flat", bd=0, padx=13, pady=9,
                  font=("DejaVu Sans", 9, "bold"), cursor="hand2").pack(side="left")
        _label(footer, "Mode requests use bridge IPC when connected; no CAN traffic.",
               9, DIM, False, PANEL).pack(side="right")
        root.protocol("WM_DELETE_WINDOW", self._close)
        self._refresh()
        root.after(500, self._periodic_refresh)

    def _close(self) -> None:
        self.state.close()
        self.root.destroy()

    def _scroll_with_pointer(self, event: Any) -> str | None:
        if event.widget.winfo_toplevel() != self.root:
            return None
        if getattr(event, "num", None) in (4, 5):
            units = -3 if event.num == 4 else 3
        else:
            delta = getattr(event, "delta", 0)
            if delta == 0:
                return None
            units = -1 if delta > 0 else 1
            if abs(delta) >= 120:
                units *= 3 * max(1, round(abs(delta) / 120))
        self.scroll_canvas.yview_scroll(units, "units")
        return "break"

    def _periodic_refresh(self) -> None:
        self._refresh()
        self.root.after(500, self._periodic_refresh)

    def _select_mode(self, mode: str) -> None:
        if not self.selected_power:
            return
        self._selection_touched = True
        self.selected_mode = mode
        self.state.set_command(self.selected_power, mode)
        self._refresh()

    def _toggle_power(self) -> None:
        self._selection_touched = True
        self.selected_power = not self.selected_power
        self.state.set_command(self.selected_power, self.selected_mode)
        self._refresh()

    def _refresh(self) -> None:
        self.snapshot = self.state.snapshot()
        request = self.snapshot["request"]
        if not self._selection_touched:
            self.selected_power = request["power_on"]
            self.selected_mode = request["mode"]
        ecu = self.snapshot["ecu"]
        self.power_button.configure(
            text="⏻  HEADLIGHTS ON" if self.selected_power else "⏻  HEADLIGHTS OFF",
            bg="#75532d" if self.selected_power else "#304351", fg=TEXT,
            activebackground="#987044" if self.selected_power else "#456174",
            activeforeground=TEXT,
        )
        for mode, button in self.mode_buttons.items():
            selected = self.selected_mode == mode
            button.configure(
                state="normal" if self.selected_power else "disabled",
                bg="#664d2c" if selected and self.selected_power else
                   PANEL_LIGHT if self.selected_power else "#26313a",
                fg=AMBER if selected else TEXT,
                disabledforeground="#64717a",
                activebackground="#89663a", activeforeground=TEXT,
                cursor="hand2" if self.selected_power else "arrow",
            )
        result = request["result"]
        title = ("No bridge request" if result["kind"] == "demo_preset" else
                 "Bridge accepted" if result["accepted"] else
                 "Waiting" if result["message"].startswith("Waiting") else "Not accepted")
        self.result_label.configure(text=f'{title}  ·  {result["message"]}')
        self.request_id_label.configure(text=f'REQUEST  {result["id"]}')
        self.status_labels["health"].configure(
            text=ecu["health_label"], fg=GREEN if ecu["health"] == "ok" else AMBER)
        self.status_labels["requested"].configure(
            text=f'{"On" if self.selected_power else "Off"} · {MODE_LABELS[self.selected_mode]}')
        connected = self.snapshot["bridge"]["connected"]
        self.status_labels["bridge"].configure(
            text="Connected" if connected else "Offline", fg=GREEN if connected else AMBER)
        self.header_status.configure(
            text="DEMO ECU  ·  BRIDGE CONNECTED" if connected else "DEMO ECU  ·  BRIDGE OFFLINE",
            fg=GREEN if connected else AMBER)
        self.surround_source_label.configure(
            text=f'Top-down proximity view · {self.snapshot["ego"]["surround_source"]}')
        self._draw_surround()
        self._draw_cluster()
        self._update_details()

    def _draw_surround(self) -> None:
        canvas = self.surround_canvas
        width = canvas.winfo_width()
        if width < 100:
            return
        canvas.delete("all")
        height = 220
        center = width / 2
        road_half = min(245.0, width * .34)
        lane_width = road_half * 2 / 3
        lateral_scale = lane_width / 3.6
        canvas.create_rectangle(center - road_half, 14, center + road_half, height - 12,
                                fill="#162a34", outline="#385564", width=2)
        for lane in (-1, 1):
            x = center + lane * lane_width / 2
            canvas.create_line(x, 18, x, height - 15, fill="#5a7887",
                               width=2, dash=(12, 12))
        for distance in (20, 40, 60, 80):
            y = height - 30 - distance * 2.25
            canvas.create_line(center - road_half, y, center + road_half, y,
                               fill="#29434f", dash=(3, 8))
            canvas.create_text(center - road_half - 12, y, text=f"{distance} m",
                               anchor="e", fill=DIM, font=("DejaVu Sans", 8))
        canvas.create_rectangle(center - 12, height - 53, center + 12, height - 23,
                                fill=CYAN, outline="#d2f4f8", width=2)
        canvas.create_text(center + 21, height - 38, text="EGO", anchor="w",
                           fill=CYAN, font=("DejaVu Sans", 9, "bold"))
        objects = self.snapshot["ego"].get("surrounding_objects", ())
        visible = 0
        for item in objects:
            forward = item["x_forward_m"]
            lateral = item["y_left_m"]
            if not 0 <= forward <= 80 or abs(lateral) > 6.5:
                continue
            visible += 1
            x = center - lateral * lateral_scale
            y = height - 30 - forward * 2.25
            canvas.create_rectangle(x - 12, y - 16, x + 12, y + 16,
                                    fill="#8b6540", outline=AMBER, width=2)
            canvas.create_line(x - 8, y - 10, x + 8, y - 10, fill="#f4d7a2", width=2)
            canvas.create_text(x, y - 23, text=f'{item["label"]}  {forward:.0f} m',
                               fill=TEXT, font=("DejaVu Sans", 8, "bold"))
        if visible == 0 and self.snapshot["ego"].get("objects_live"):
            canvas.create_text(center, 90, text="NO VEHICLES IN VIEW", fill=MUTED,
                               font=("DejaVu Sans", 10, "bold"))
        canvas.create_text(16, height - 17,
                           text="LIVE RUNNER VEHICLES" if self.snapshot["ego"].get("objects_live")
                           else "SIMULATED OBJECT POSITIONS",
                           anchor="w", fill=CYAN if self.snapshot["ego"].get("objects_live")
                           else AMBER, font=("DejaVu Sans", 8, "bold"))

    def _draw_cluster(self) -> None:
        canvas = self.cluster
        width = canvas.winfo_width()
        if width < 100:
            return
        canvas.delete("all")
        height = 390
        canvas.create_rectangle(7, 7, width - 7, height - 7, outline="#213440", width=1)
        ego = self.snapshot["ego"]
        live = ego.get("speed_live") or ego.get("steering_live")
        canvas.create_text(25, 24, text="02  VEHICLE METERS  /  BRIDGE RUNNER + DEMO" if live
                           else "02  VEHICLE METERS  /  DEMO FALLBACK", anchor="w",
                           fill=CYAN, font=("DejaVu Sans", 9, "bold"))
        canvas.create_text(width - 25, 24, text="HEADLIGHT SELECTION PREVIEW",
                           anchor="e", fill=DIM, font=("DejaVu Sans", 8, "bold"))
        radius = min(112, width * .12)
        self._draw_speed_gauge(width * .19, 170, radius)
        self._draw_road(width * .5, width * .25)
        self._draw_steering_gauge(width * .81, 170, radius)
        canvas.create_text(width * .19, 170 + radius + 27, text="SPEED",
                           fill=MUTED, font=("DejaVu Sans", 10, "bold"))
        canvas.create_text(width * .81, 170 + radius + 27, text="STEERING",
                           fill=MUTED, font=("DejaVu Sans", 10, "bold"))
        canvas.create_line(22, 354, width - 22, 354, fill="#2b404d")
        canvas.create_text(27, 372, text="●  LIVE SPEED/STEERING + DEMO DETAILS" if live
                           else "●  DISPLAY SOURCE: DEMO FALLBACK", anchor="w",
                           fill=AMBER, font=("DejaVu Sans", 8, "bold"))
        canvas.create_text(width - 27, 372, text="ECU CAN STATUS UNAVAILABLE" if self.snapshot["bridge"]["connected"]
                           else "BRIDGE & ECU CONNECTION OFFLINE",
                           anchor="e", fill=DIM, font=("DejaVu Sans", 8, "bold"))

    def _draw_speed_gauge(self, cx: float, cy: float, radius: float) -> None:
        canvas = self.cluster
        ego = self.snapshot["ego"]
        fraction = max(0.0, min(1.0, ego["speed_kmh"] / 160.0))
        canvas.create_oval(cx - radius - 8, cy - radius - 8, cx + radius + 8,
                           cy + radius + 8, fill="#0c151e", outline=BORDER, width=2)
        box = (cx - radius + 17, cy - radius + 17, cx + radius - 17, cy + radius - 17)
        canvas.create_arc(*box, start=225, extent=-270, style="arc", outline="#304653", width=7)
        if fraction > 0:
            canvas.create_arc(*box, start=225, extent=-270 * fraction, style="arc",
                              outline=CYAN, width=7)
        for index in range(17):
            angle = math.radians(225 - 270 * index / 16)
            major = index % 4 == 0
            outer = radius - 4
            inner = outer - (11 if major else 6)
            canvas.create_line(cx + inner * math.cos(angle), cy - inner * math.sin(angle),
                               cx + outer * math.cos(angle), cy - outer * math.sin(angle),
                               fill="#b5ced7" if major else "#55727f", width=2 if major else 1)
        angle = math.radians(225 - 270 * fraction)
        canvas.create_line(cx, cy, cx + (radius - 44) * math.cos(angle),
                           cy - (radius - 44) * math.sin(angle), fill=AMBER, width=3)
        canvas.create_oval(cx - 6, cy - 6, cx + 6, cy + 6, fill=AMBER, outline="#533b20")
        canvas.create_text(cx, cy + 37, text=f'{ego["speed_kmh"]:.1f}', fill=TEXT,
                           font=("DejaVu Sans", 30, "bold"))
        canvas.create_text(cx, cy + 64, text="km/h", fill=MUTED,
                           font=("DejaVu Sans", 10))
        for value, angle_deg in (("0", 225), ("80", 90), ("160", -45)):
            angle = math.radians(angle_deg)
            canvas.create_text(cx + (radius - 32) * math.cos(angle),
                               cy - (radius - 32) * math.sin(angle), text=value,
                               fill=DIM, font=("DejaVu Sans", 9, "bold"))

    def _draw_road(self, cx: float, half_width: float) -> None:
        canvas = self.cluster
        mode = self.selected_mode if self.selected_power else "off"
        canvas.create_text(cx, 61, text="ADAPTIVE FRONT LIGHTING · PREVIEW", fill=AMBER,
                           font=("DejaVu Sans", 9, "bold"))
        road_top = 78
        road_bottom = 250
        canvas.create_polygon(cx - half_width * .46, road_top, cx + half_width * .46,
                              road_top, cx + half_width * .72, road_bottom,
                              cx - half_width * .72, road_bottom,
                              fill="#152935", outline="#325265")
        for side in (-1, 1):
            x_top = cx + side * half_width * .22
            x_bottom = cx + side * half_width * .34
            for step in range(4):
                y0 = road_top + step * 39
                y1 = y0 + 22
                x0 = x_top + (x_bottom - x_top) * (y0 - road_top) / (road_bottom - road_top)
                x1 = x_top + (x_bottom - x_top) * (y1 - road_top) / (road_bottom - road_top)
                canvas.create_line(x0, y0, x1, y1, fill="#66889a", width=2)
        if mode != "off":
            high_beam = mode.startswith("high_beam")
            lamp_y = 175
            low_top = 120
            high_top = 83
            swivel = max(-35.0, min(35.0, self.snapshot["ego"]["steering_deg"]))
            swivel_shift = swivel * .7 if mode == "low_beam_swivel" else 0.0
            for side in (-1, 1):
                origin = cx + side * 18
                low_edge = cx + side * half_width * .27 + swivel_shift
                low_inner = cx + side * 5 + swivel_shift
                canvas.create_polygon(origin - 5, lamp_y, low_edge, low_top,
                                      low_inner, low_top, origin + 5, lamp_y,
                                      fill="#6f603c", stipple="gray50",
                                      outline="")
                if not high_beam:
                    canvas.create_line(origin, lamp_y, low_edge, low_top,
                                       fill="#a8844c", width=1)
                    continue

                high_inner = cx + side * 5
                high_edge = cx + side * half_width * .42
                lit_ranges = ((high_inner, high_edge),)
                if mode == "high_beam_dimming" and side == 1:
                    # Omit this fan sector so the road itself shows through the gap.
                    span = high_edge - high_inner
                    cut_start = high_inner + span * .30
                    cut_end = high_inner + span * .63
                    lit_ranges = ((high_inner, cut_start), (cut_end, high_edge))
                    target_y = 102
                    target_fraction = (lamp_y - target_y) / (lamp_y - high_top)
                    target_x = origin + ((cut_start + cut_end) / 2 - origin) * target_fraction
                    canvas.create_rectangle(target_x - 6, target_y - 8,
                                            target_x + 6, target_y + 8,
                                            fill="#52646d", outline="#d3dce0", width=1)
                    canvas.create_line(target_x - 4, target_y - 5,
                                       target_x + 4, target_y - 5,
                                       fill="#f0c782", width=2)
                for start, end in lit_ranges:
                    canvas.create_polygon(origin, lamp_y, start, high_top, end, high_top,
                                          fill="#9b753e", stipple="gray50", outline="")
                canvas.create_line(origin, lamp_y, high_edge, high_top,
                                   fill="#a8844c", width=1)
            if mode == "low_beam_swivel":
                canvas.create_text(cx, 105, text="SWIVEL AIM", fill=AMBER,
                                   font=("DejaVu Sans", 8, "bold"))
                canvas.create_line(cx - 27, 157, cx + 27, 157, fill=CYAN,
                                   width=2, arrow="both")
        canvas.create_polygon(cx - 25, 219, cx - 21, 183, cx - 14, 168,
                              cx + 14, 168, cx + 21, 183, cx + 25, 219,
                              cx + 18, 241, cx - 18, 241,
                              fill="#263e4f", outline="#9fbdca", width=2)
        canvas.create_polygon(cx - 15, 189, cx - 11, 178, cx + 11, 178,
                              cx + 15, 189, fill="#52778a")
        canvas.create_line(cx - 23, 177, cx - 14, 175, fill=AMBER, width=4)
        canvas.create_line(cx + 14, 175, cx + 23, 177, fill=AMBER, width=4)
        canvas.create_text(cx, 271, text="SELECTED MODE" if mode != "off"
                           else "HEADLIGHTS OFF", fill=DIM,
                           font=("DejaVu Sans", 8, "bold"))
        mode_label = "Off" if mode == "off" else {
            "low_beam_no_swivel": "Low beam · fixed aim",
            "low_beam_swivel": "Low beam · swivel",
            "high_beam_no_dimming": "High beam · full",
            "high_beam_dimming": "High beam · ADB dimming",
        }[mode]
        canvas.create_text(cx, 294, text=mode_label, fill=TEXT,
                           font=("DejaVu Sans", 14, "bold"))
        canvas.create_text(cx, 313, text="Selection preview · ECU state simulated", fill=AMBER,
                           font=("DejaVu Sans", 9))

    def _draw_steering_gauge(self, cx: float, cy: float, radius: float) -> None:
        canvas = self.cluster
        angle_deg = self.snapshot["ego"]["steering_deg"]
        canvas.create_oval(cx - radius - 8, cy - radius - 8, cx + radius + 8,
                           cy + radius + 8, fill="#0c151e", outline=BORDER, width=2)
        box = (cx - radius + 17, cy - radius + 17, cx + radius - 17, cy + radius - 17)
        canvas.create_arc(*box, start=225, extent=-270, style="arc", outline="#304653", width=7)
        canvas.create_oval(cx - 55, cy - 55, cx + 55, cy + 55, outline="#668493", width=6)
        canvas.create_line(cx - 53, cy, cx + 53, cy, fill="#668493", width=6)
        canvas.create_line(cx, cy, cx, cy + 53, fill="#668493", width=6)
        pointer = math.radians(90 - max(-45, min(45, angle_deg)) * 2)
        canvas.create_line(cx, cy, cx + (radius - 40) * math.cos(pointer),
                           cy - (radius - 40) * math.sin(pointer), fill=CYAN, width=4)
        canvas.create_oval(cx - 10, cy - 10, cx + 10, cy + 10,
                           fill="#243a49", outline="#a3c0cc", width=2)
        sign = "+" if angle_deg > 0 else "−" if angle_deg < 0 else ""
        canvas.create_text(cx, cy + 84, text=f"{sign}{abs(angle_deg):.1f}°", fill=TEXT,
                           font=("DejaVu Sans", 23, "bold"))
        canvas.create_text(cx - radius + 25, cy, text="L", fill=DIM,
                           font=("DejaVu Sans", 10, "bold"))
        canvas.create_text(cx + radius - 25, cy, text="R", fill=DIM,
                           font=("DejaVu Sans", 10, "bold"))

    def _open_details(self) -> None:
        if self.details_window is not None:
            self.details_window.deiconify()
            self.details_window.lift()
            return
        window = tk.Toplevel(self.root, bg=BG)
        window.title("AFS Detailed Status")
        window.geometry("850x600")
        window.minsize(750, 540)
        window.protocol("WM_DELETE_WINDOW", window.withdraw)
        self.details_window = window
        header = tk.Frame(window, bg=BG, padx=24, pady=18)
        header.pack(fill="x")
        _label(header, "VEHICLE & ECU DATA", 9, DIM, True).pack(anchor="w")
        _label(header, "Detailed status", 19, TEXT, True).pack(anchor="w")
        _label(header, "Fresh runner fields may be live; ECU and proximity-grid values are simulated.",
               10, MUTED).pack(anchor="w")
        content = tk.Frame(window, bg=BG, padx=24)
        content.pack(fill="both", expand=True)
        for column in range(2):
            content.grid_columnconfigure(column, weight=1, uniform="details")
        for row in range(2):
            content.grid_rowconfigure(row, weight=1)
        vehicle = self._detail_card(content, 0, 0, "EGO VEHICLE · MIXED SOURCES")
        self.detail_values["ego_source"] = _label(vehicle, "", 8, AMBER, False, PANEL,
                                                   wraplength=330, justify="left")
        self.detail_values["ego_source"].pack(anchor="w", pady=(0, 8))
        for key, caption in (("speed", "Speed"), ("steering", "Steering"),
                             ("heading", "Heading"), ("position", "Position X, Y")):
            line = tk.Frame(vehicle, bg=PANEL, pady=5)
            line.pack(fill="x")
            _label(line, caption, 10, MUTED, False, PANEL).pack(side="left")
            self.detail_values[key] = _label(line, "", 11, TEXT, True, PANEL)
            self.detail_values[key].pack(side="right")
        output = self._detail_card(content, 0, 1, "LAMP OUTPUT · SIMULATED ECU")
        for key, caption in (("left_servo", "Left servo"),
                             ("right_servo", "Right servo"), ("dim_mask", "Applied dim mask")):
            line = tk.Frame(output, bg=PANEL, pady=5)
            line.pack(fill="x")
            _label(line, caption, 10, MUTED, False, PANEL).pack(side="left")
            self.detail_values[key] = _label(line, "", 11, TEXT, True, PANEL)
            self.detail_values[key].pack(side="right")
        grid_card = self._detail_card(content, 1, 0, "OBJECT PROXIMITY · 10 SECTORS")
        self.grid_canvas = tk.Canvas(grid_card, height=155, bg=PANEL, bd=0,
                                     highlightthickness=0)
        self.grid_canvas.pack(fill="x")
        fault = self._detail_card(content, 1, 1, "ECU FAULTS · SIMULATED ECU")
        self.detail_values["fault"] = _label(fault, "", 11, AMBER, True, PANEL,
                                              wraplength=330, justify="left")
        self.detail_values["fault"].pack(anchor="w", pady=10)
        tk.Button(fault, text="Request fault clear", command=self._clear_fault,
                  bg=PANEL_LIGHT, fg=CYAN, activebackground="#284354",
                  activeforeground=TEXT, relief="flat", bd=0, padx=11, pady=8,
                  cursor="hand2").pack(anchor="w")
        self.detail_values["action"] = _label(fault, "", 9, MUTED, False, PANEL,
                                               wraplength=330, justify="left")
        self.detail_values["action"].pack(anchor="w", pady=(10, 0))
        self._update_details()

    def _detail_card(self, parent: Any, row: int, column: int, title: str) -> Any:
        card = tk.Frame(parent, bg=PANEL, padx=15, pady=14,
                        highlightbackground=BORDER, highlightthickness=1)
        card.grid(row=row, column=column, sticky="nsew",
                  padx=(0 if column == 0 else 6, 0 if column == 1 else 6),
                  pady=(0 if row == 0 else 6, 0 if row == 1 else 6))
        _label(card, title, 9, DIM, True, PANEL).pack(anchor="w", pady=(0, 10))
        return card

    def _clear_fault(self) -> None:
        self.state.clear_fault()
        self._refresh()

    def _update_details(self) -> None:
        if self.details_window is None:
            return
        ego = self.snapshot["ego"]
        ecu = self.snapshot["ecu"]
        self.detail_values["speed"].configure(text=f'{ego["speed_kmh"]:.1f} km/h')
        self.detail_values["ego_source"].configure(text=ego["source"])
        self.detail_values["steering"].configure(text=f'{ego["steering_deg"]:+.1f}°')
        self.detail_values["heading"].configure(text=f'{ego["heading_deg"]:+.1f}°')
        self.detail_values["position"].configure(
            text=f'{ego["position_x_m"]:.1f}, {ego["position_y_m"]:.1f} m')
        self.detail_values["left_servo"].configure(
            text=f'{ecu["left_servo_feedback_deg"]:+.1f}°')
        self.detail_values["right_servo"].configure(
            text=f'{ecu["right_servo_feedback_deg"]:+.1f}°')
        self.detail_values["dim_mask"].configure(
            text=f'0x{ecu["applied_dim_sector_mask"]:03X}')
        faults = ecu["faults"]
        self.detail_values["fault"].configure(
            text="No active demo faults" if not faults else
                 "\n".join(f'{fault["name"]}: {fault["detail"]}' for fault in faults),
            fg=GREEN if not faults else AMBER)
        self.detail_values["action"].configure(
            text=self.snapshot["request"]["last_action"]["message"])
        canvas = self.grid_canvas
        canvas.delete("all")
        width = max(canvas.winfo_width(), 300)
        cell_width = min(29, (width - 90) / 10)
        labels = (("0–25 m", 3), ("25–50 m", 2), ("50–75 m", 1), ("75–100 m", 0))
        for index, (label, bit) in enumerate(labels):
            y = 15 + index * 34
            canvas.create_text(75, y + 10, text=label, anchor="e", fill=MUTED,
                               font=("DejaVu Sans", 8))
            for sector, mask in enumerate(ego["sector_masks"]):
                x = 85 + sector * cell_width
                active = bool(mask & (1 << bit))
                canvas.create_rectangle(x, y, x + cell_width - 4, y + 20,
                                        fill=AMBER if active else "#30434f", outline="")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Open the native AFS Dashboard window.")
    parser.add_argument("--socket", help="Dashboard bridge socket path")
    args = parser.parse_args(argv)
    try:
        import tkinter as tkinter_module
    except ImportError:
        print("AFS Dashboard requires Python with Tkinter. Use the MetaDrive virtual environment.",
              file=sys.stderr)
        return 1
    global tk
    tk = tkinter_module
    try:
        root = tk.Tk()
    except tk.TclError as error:
        print(f"Cannot open AFS Dashboard window: {error}", file=sys.stderr)
        return 1
    DashboardWindow(root, GatewayDashboardState(args.socket))
    root.mainloop()
    return 0
