"use strict";

const canvas = document.getElementById("scene-canvas");
const context = canvas.getContext("2d");
const zoomInput = document.getElementById("zoom");
const zoomValue = document.getElementById("zoom-value");
const emptyMessage = document.getElementById("canvas-empty");

let latestPayload = null;
let selectedId = null;
let screenObjects = [];

const element = (id) => document.getElementById(id);
const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "—";
const meters = (value) => Number.isFinite(value) ? `${value.toFixed(1)} m` : "—";
const radians = (value) => Number.isFinite(value) ? `${value.toFixed(3)} rad` : "—";
const vector = (value, unit, digits = 1) => Array.isArray(value)
  ? `${number(value[0], digits)}, ${number(value[1], digits)} ${unit}`
  : "—";

function setState(state, age, detail) {
  const labels = {
    live: "Live",
    empty: "Live · empty scan",
    stale: "Stale sample",
    degraded: "Degraded scan",
    invalid: "Invalid scene",
    waiting: "Waiting",
    disconnected: "Disconnected",
    error: "Display error",
  };
  const dot = element("state-dot");
  dot.className = `state-dot ${state}`;
  element("state-label").textContent = labels[state] || state;
  element("sample-age").textContent = Number.isFinite(age)
    ? `${age.toFixed(2)} s old`
    : (detail || "No scene published");
}

function resizeCanvas(target, drawingContext) {
  const rect = target.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
  drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawScene();
}

function drawScene() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  context.clearRect(0, 0, width, height);
  screenObjects = [];

  const scene = latestPayload?.scene;
  if (!scene) {
    emptyMessage.hidden = false;
    emptyMessage.textContent = latestPayload?.state === "error"
      ? (latestPayload.error || "Scene display error")
      : "Waiting for the first scene…";
    return;
  }

  const surrounding = scene.surrounding;
  const objects = surrounding.objects || [];

  const zoom = Number(zoomInput.value);
  const viewRadius = Math.max(1, surrounding.radius_m / zoom);
  const visibleObjects = objects.filter((object) => object.distance_m <= viewRadius);
  emptyMessage.hidden = visibleObjects.length > 0;
  emptyMessage.textContent = scene.valid
    ? (objects.length ? "No objects within the displayed range" : "No collected objects")
    : "Scene data is invalid";
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width * 0.43, height * 0.43) / viewRadius;

  drawGrid(context, centerX, centerY, scale, viewRadius, width, height);
  drawEgo(context, centerX, centerY, scale);
  for (const object of visibleObjects) drawObject(object, centerX, centerY, scale);
}

function drawGrid(ctx, centerX, centerY, scale, radius, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(139, 164, 178, 0.25)";
  ctx.fillStyle = "#8ba4b2";
  ctx.lineWidth = 1;
  ctx.font = "11px ui-monospace, monospace";
  const ringStep = chooseRingStep(radius);
  for (let distance = ringStep; distance <= radius + 0.001; distance += ringStep) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, distance * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(`${distance} m`, centerX + 5, centerY - distance * scale + 13);
  }
  ctx.strokeStyle = "rgba(68, 214, 197, 0.28)";
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  ctx.restore();
}

function chooseRingStep(radius) {
  if (radius <= 20) return 5;
  if (radius <= 50) return 10;
  if (radius <= 120) return 25;
  return 50;
}

function drawEgo(ctx, x, y, scale) {
  const length = Math.max(22, 4.7 * scale);
  const width = Math.max(12, 1.9 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#44d6c5";
  ctx.strokeStyle = "#d6fffa";
  ctx.lineWidth = 1.5;
  roundedRectangle(ctx, -width / 2, -length / 2, width, length, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -length / 2 - 9);
  ctx.lineTo(-5, -length / 2);
  ctx.lineTo(5, -length / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObject(object, centerX, centerY, scale) {
  const position = object.relative_position_m;
  if (!Array.isArray(position)) return;
  const x = centerX - position[1] * scale;
  const y = centerY - position[0] * scale;
  const selected = object.object_id === selectedId;
  const color = objectColor(object.object_type);
  const length = Number.isFinite(object.length_m) ? Math.max(8, object.length_m * scale) : 10;
  const width = Number.isFinite(object.width_m) ? Math.max(7, object.width_m * scale) : 10;

  context.save();
  context.translate(x, y);
  context.rotate(-(object.relative_heading_rad || 0));
  context.fillStyle = color;
  context.strokeStyle = selected ? "#ffffff" : "rgba(255, 255, 255, 0.58)";
  context.lineWidth = selected ? 3 : 1;
  if (object.object_type === "PEDESTRIAN" || object.object_type === "CYCLIST") {
    context.beginPath();
    context.arc(0, 0, Math.max(5, width / 2), 0, Math.PI * 2);
  } else {
    roundedRectangle(context, -width / 2, -length / 2, width, length, 2);
  }
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(0, -length / 2 - 6);
  context.lineTo(-4, -length / 2);
  context.lineTo(4, -length / 2);
  context.closePath();
  context.fill();
  context.restore();

  drawVelocity(object.relative_velocity_mps, x, y, scale);
  context.fillStyle = selected ? "#ffffff" : "#d9e9ef";
  context.font = `${selected ? "700" : "500"} 11px ui-monospace, monospace`;
  context.fillText(object.object_id, x + 8, y - 8);
  screenObjects.push({ id: object.object_id, x, y, radius: Math.max(12, width, length) });
}

function drawVelocity(velocity, x, y, scale) {
  if (!Array.isArray(velocity)) return;
  const dx = -velocity[1] * scale * 0.6;
  const dy = -velocity[0] * scale * 0.6;
  if (Math.hypot(dx, dy) < 2) return;
  context.save();
  context.strokeStyle = "#ffbf5a";
  context.fillStyle = "#ffbf5a";
  context.lineWidth = 1.7;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + dx, y + dy);
  context.stroke();
  const angle = Math.atan2(dy, dx);
  context.beginPath();
  context.moveTo(x + dx, y + dy);
  context.lineTo(x + dx - 7 * Math.cos(angle - 0.45), y + dy - 7 * Math.sin(angle - 0.45));
  context.lineTo(x + dx - 7 * Math.cos(angle + 0.45), y + dy - 7 * Math.sin(angle + 0.45));
  context.closePath();
  context.fill();
  context.restore();
}

function roundedRectangle(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
}

function objectColor(type) {
  if (type === "VEHICLE") return "#55a9ff";
  if (type === "PEDESTRIAN" || type === "CYCLIST") return "#e590ff";
  return "#ffad66";
}

function updateSummary(scene) {
  if (!scene) {
    for (const id of ["sample-id", "sim-time", "ego-speed", "ego-steering", "object-count", "scan-radius", "scene-valid", "scanned-count", "skipped-count", "ego-pose", "ego-velocity", "throttle-brake", "control-mode", "lane-state", "collision-state", "route-state"]) {
      element(id).textContent = "—";
    }
    element("diagnostic-errors").textContent = "No diagnostics";
    updateDetail(null);
    updateTable([]);
    return;
  }
  const sample = scene.sample;
  const ego = scene.ego;
  const surrounding = scene.surrounding;
  element("sample-id").textContent = `${sample.seed ?? "—"} / ${sample.episode_step ?? "—"}`;
  element("sim-time").textContent = Number.isFinite(sample.sim_time_s) ? `${sample.sim_time_s.toFixed(2)} s` : "—";
  element("ego-speed").textContent = Number.isFinite(ego.kinematics.speed_kph) ? `${ego.kinematics.speed_kph.toFixed(1)} km/h` : "—";
  element("ego-steering").textContent = Number.isFinite(ego.action.steering_normalized) ? ego.action.steering_normalized.toFixed(3) : "—";
  element("object-count").textContent = String(surrounding.objects.length);
  element("scan-radius").textContent = meters(surrounding.radius_m);
  element("scene-valid").textContent = scene.valid ? (scene.degraded ? "Degraded" : "Valid") : "Invalid";
  element("scanned-count").textContent = String(surrounding.scanned_count);
  element("skipped-count").textContent = String(surrounding.skipped_count);
  element("ego-pose").textContent = `${vector(ego.kinematics.position_m, "m")} · ${radians(ego.kinematics.heading_rad)}`;
  element("ego-velocity").textContent = vector(ego.kinematics.velocity_mps, "m/s");
  element("throttle-brake").textContent = number(ego.action.throttle_brake, 3);
  element("control-mode").textContent = controlText(ego.control);
  element("lane-state").textContent = laneText(ego.diagnostics);
  element("collision-state").textContent = collisionText(ego.diagnostics);
  element("route-state").textContent = ego.diagnostics.out_of_route === true ? "Out of route" : (ego.diagnostics.out_of_route === false ? "On route" : "—");
  const errors = [...(ego.errors || []), ...(surrounding.errors || [])];
  element("diagnostic-errors").textContent = errors.length ? errors.join("\n") : "No diagnostics";

  if (selectedId && !surrounding.objects.some((object) => object.object_id === selectedId)) {
    selectedId = null;
  }
  updateTable(surrounding.objects);
  updateDetail(surrounding.objects.find((object) => object.object_id === selectedId) || null);
}

function updateTable(objects) {
  const body = element("object-rows");
  body.replaceChildren();
  if (!objects.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 11;
    cell.className = "empty-cell";
    cell.textContent = "No eligible objects in the current scan";
    row.append(cell);
    body.append(row);
    return;
  }
  for (const object of objects) {
    const row = document.createElement("tr");
    row.dataset.objectId = object.object_id;
    row.classList.toggle("selected", object.object_id === selectedId);
    const values = [
      object.object_id,
      object.object_type,
      meters(object.distance_m),
      radians(object.bearing_rad),
      vector(object.world_position_m, "m"),
      vector(object.world_velocity_mps, "m/s"),
      radians(object.heading_rad),
      vector(object.relative_position_m, "m"),
      vector(object.relative_velocity_mps, "m/s"),
      radians(object.relative_heading_rad),
      dimensions(object),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    row.addEventListener("click", () => selectObject(object.object_id));
    body.append(row);
  }
}

function dimensions(object) {
  const values = [object.length_m, object.width_m, object.height_m];
  return values.some(Number.isFinite) ? values.map((value) => number(value, 2)).join(" × ") + " m" : "—";
}

function controlText(control) {
  const parts = [control.mode || "unknown"];
  if (Number.isFinite(control.target_speed_kph)) parts.push(`${control.target_speed_kph.toFixed(1)} km/h target`);
  if (Number.isFinite(control.target_steering_normalized)) parts.push(`${control.target_steering_normalized.toFixed(3)} steer target`);
  return parts.join(" · ");
}

function laneText(diagnostics) {
  const lane = diagnostics.on_lane === true ? "On lane" : (diagnostics.on_lane === false ? "Off lane" : "Lane unknown");
  const index = diagnostics.lane_index == null ? "" : ` · ${JSON.stringify(diagnostics.lane_index)}`;
  return lane + index;
}

function collisionText(diagnostics) {
  const states = [
    ["vehicle", diagnostics.crash_vehicle],
    ["object", diagnostics.crash_object],
    ["building", diagnostics.crash_building],
    ["sidewalk", diagnostics.crash_sidewalk],
  ];
  const collisions = states.filter((entry) => entry[1] === true).map((entry) => entry[0]);
  if (collisions.length) return collisions.join(", ");
  return states.every((entry) => entry[1] === false) ? "None" : "Unknown";
}

function updateDetail(object) {
  element("detail-title").textContent = object ? object.object_id : "No object selected";
  const values = object ? [
    object.object_type,
    meters(object.distance_m),
    radians(object.bearing_rad),
    vector(object.world_position_m, "m"),
    vector(object.world_velocity_mps, "m/s"),
    radians(object.heading_rad),
    vector(object.relative_position_m, "m"),
    vector(object.relative_velocity_mps, "m/s"),
    radians(object.relative_heading_rad),
    dimensions(object),
  ] : Array(10).fill("—");
  const targets = element("object-detail").querySelectorAll("dd");
  values.forEach((value, index) => { targets[index].textContent = value; });
}

function selectObject(id) {
  selectedId = id;
  updateSummary(latestPayload?.scene || null);
  drawScene();
  document.querySelector(`tr[data-object-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const nearest = screenObjects
    .map((object) => ({ ...object, distance: Math.hypot(object.x - x, object.y - y) }))
    .filter((object) => object.distance <= object.radius)
    .sort((a, b) => a.distance - b.distance)[0];
  if (nearest) selectObject(nearest.id);
});

zoomInput.addEventListener("input", () => {
  zoomValue.value = `${Number(zoomInput.value).toFixed(1)}×`;
  drawScene();
});

async function pollScene() {
  try {
    const response = await fetch("/api/scene", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    latestPayload = await response.json();
    setState(latestPayload.state, latestPayload.age_s, latestPayload.error);
    updateSummary(latestPayload.scene);
    drawScene();
  } catch (error) {
    setState("disconnected", null, error.message);
  }
}

const resizeScene = () => resizeCanvas(canvas, context);
new ResizeObserver(resizeScene).observe(canvas.parentElement);
window.addEventListener("resize", resizeScene);
resizeScene();
pollScene();
setInterval(pollScene, 100);
