const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "beam-segments.html"), "utf8");
const source = fs.readFileSync(path.join(root, "beam-segments.js"), "utf8");
const model = require("./beam-model.js");

function scene(search = "") {
  const elements = new Map();
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    elements.set(match[1], makeElement(match[1]));
  }
  elements.get("leftVisible").checked = true;
  const document = {
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => makeElement(tag),
    createElementNS: (_, tag) => makeElement(tag),
  };
  const window = { location: { search }, AfsBeamModel: model };
  vm.runInNewContext(source, { document, window, URLSearchParams });
  return (id) => elements.get(id);
}

function makeElement(name) {
  const classes = new Set();
  const listeners = new Map();
  return {
    name,
    children: [],
    dataset: {},
    attributes: {},
    style: { setProperty(key, value) { this[key] = value; } },
    classList: {
      toggle(key, enabled) {
        if (enabled) classes.add(key);
        else classes.delete(key);
      },
      contains: (key) => classes.has(key),
    },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (key.startsWith("data-")) {
        this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
      }
    },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    addEventListener(event, callback) { listeners.set(event, callback); },
    trigger(event) { listeners.get(event)?.(); },
  };
}

test("default scene keeps ten road sectors and renders two 8x8 matrix lamps", () => {
  const get = scene();
  assert.equal(get("gridSectorCount").textContent, "10");
  assert.equal(get("gridLines").children.filter((item) => item.attributes.class === "grid-ray").length, 11);
  const sectorLabels = get("sectorLabels").children.map((label) => label.textContent);
  assert.deepEqual(sectorLabels, Array.from({ length: 10 }, (_, index) => String(index).padStart(2, "0")));
  for (const ray of get("gridLines").children.filter((item) => item.attributes.class === "grid-ray")) {
    const oldBoundaryIndex = Number(ray.dataset.boundary) + 3;
    const normalized = 1 - 2 * oldBoundaryIndex / 16;
    const oldAngleDeg = 25 * Math.sign(normalized) * Math.abs(normalized) ** 1.2;
    const currentAngleDeg = Math.atan2(
      Number(ray.attributes.x1) - Number(ray.attributes.x2),
      Number(ray.attributes.y1) - Number(ray.attributes.y2),
    ) * 180 / Math.PI;
    assert.ok(Math.abs(currentAngleDeg - oldAngleDeg) < 1e-9);
  }
  assert.equal(get("headlightBeams").children.length, 16);
  assert.equal(get("lowBeamBase").children.length, 2);
  assert.equal(get("highBeamTab").attributes["aria-current"], "page");
  assert.equal(get("lowBeamTab").attributes["aria-current"], "false");
  assert.equal(get("steeringControl").hidden, true);
  assert.equal(get("leftMatrixFace").style["--swivel-angle"], "0deg");
  assert.equal(get("leftZoneStrip").children.length, 8);
  assert.equal(get("rightZoneStrip").children.length, 8);
  assert.equal(get("leftHighPixels").children.length, 32);
  assert.equal(get("leftLowPixels").children.length, 32);
  assert.equal(get("rightHighPixels").children.length, 32);
  assert.equal(get("rightLowPixels").children.length, 32);
  const leftLitCount = get("leftHighPixels").children.concat(get("leftLowPixels").children)
    .filter((pixel) => pixel.classList.contains("is-lit")).length;
  assert.match(get("leftMatrixState").textContent, new RegExp(`${leftLitCount}/64 on`));
  assert.ok(leftLitCount > 32 && leftLitCount < 64);
  const colors = [...get("leftZoneStrip").children, ...get("rightZoneStrip").children]
    .map((button) => button.style["--zone-color"]);
  assert.equal(new Set(colors).size, 16);
  assert.ok(get("leftLowPixels").children.every((pixel) => pixel.classList.contains("is-lit")));
  assert.ok(get("rightLowPixels").children.every((pixel) => pixel.classList.contains("is-lit")));
  assert.ok([...get("leftHighPixels").children, ...get("rightHighPixels").children]
    .some((pixel) => pixel.classList.contains("is-masked")));
  assert.equal(get("lampEmitters").children.length, 2);
  assert.notEqual(
    get("lampEmitters").children[0].children[0].attributes.x1,
    get("lampEmitters").children[1].children[0].attributes.x1,
  );
  for (const emitter of get("lampEmitters").children) {
    const zone = get("headlightBeams").children.find((item) => item.dataset.lamp === emitter.dataset.lamp);
    const beamOriginX = Number(zone.attributes.d.match(/^M ([\d.]+)/)[1]);
    assert.ok(Math.abs(beamOriginX - Number(emitter.children[0].attributes.x1)) < 1e-6);
  }
  assert.match(get("roadMaskReadout").textContent, /0x[0-9A-F]{3}/);
  assert.notEqual(get("roadMaskReadout").textContent, "Logical road mask 0x000");
  assert.match(get("lampMaskReadout").textContent, /L: C\d+ 4\/4/);
  assert.match(get("lampMaskReadout").textContent, /R: C\d+ 4\/4/);
  assert.ok(get("headlightBeams").children.some((zone) => zone.dataset.lamp === "left" && zone.classList.contains("is-dimmed")));
  assert.ok(get("headlightBeams").children.some((zone) => zone.dataset.lamp === "right" && zone.classList.contains("is-dimmed")));
});

test("both lamps together illuminate every retained sector at highway distance", () => {
  const get = scene();
  const covered = new Set();
  for (const side of ["left", "right"]) {
    for (const button of get(`${side}ZoneStrip`).children) {
      button.trigger("click");
      for (const cell of get("sectorCells").children) {
        if (cell.dataset.band === "9" && cell.classList.contains("is-zone-covered")) {
          covered.add(Number(cell.dataset.sector));
        }
      }
      button.trigger("click");
    }
  }
  assert.deepEqual([...covered].sort((a, b) => a - b), Array.from({ length: 10 }, (_, index) => index));
  for (const [side, zoneIndex, sectorIndex] of [
    ["left", 0, 0], ["right", 7, 9],
  ]) {
    const button = get(`${side}ZoneStrip`).children[zoneIndex];
    button.trigger("click");
    assert.ok(get("sectorCells").children.some((cell) =>
      cell.dataset.band === "0" && cell.dataset.sector === String(sectorIndex)
      && cell.classList.contains("is-zone-covered")));
    button.trigger("click");
  }
});

test("hiding vehicles clears both lamp masks; moving one recomputes them", () => {
  const get = scene();
  for (const lane of ["left", "center", "right"]) {
    get(`${lane}Visible`).checked = false;
    get(`${lane}Visible`).trigger("change");
  }
  assert.equal(get("lampMaskReadout").textContent, "High-beam top rows switched off — L: none · R: none");
  assert.equal(get("roadMaskReadout").textContent, "Logical road mask 0x000");
  assert.ok(get("leftZoneStrip").children.every((button) => button.children[2].textContent === "ON"));
  get("leftVisible").checked = true;
  get("leftVisible").trigger("change");
  const before = get("lampMaskReadout").textContent;
  get("leftRange").value = "80";
  get("leftRange").trigger("input");
  assert.notEqual(get("lampMaskReadout").textContent, before);
  assert.ok(get("headlightBeams").children.some((zone) => zone.dataset.lamp === "right" && zone.classList.contains("is-dimmed")));
});

test("vehicle distance selects one to four top rows in its affected columns", () => {
  const get = scene();
  for (const lane of ["center", "right"]) {
    get(`${lane}Visible`).checked = false;
    get(`${lane}Visible`).trigger("change");
  }
  for (const [distance, expectedRows] of [[100, 1], [70, 2], [50, 3], [30, 4]]) {
    get("leftRange").value = String(distance);
    get("leftRange").trigger("input");
    const entries = [...get("lampMaskReadout").textContent.matchAll(/C\d+ (\d)\/4/g)];
    assert.ok(entries.length > 0);
    assert.ok(entries.every((entry) => Number(entry[1]) === expectedRows));
    for (const side of ["left", "right"]) {
      const pixels = get(`${side}HighPixels`).children;
      const maskedByColumn = new Map();
      for (const pixel of pixels) {
        if (!pixel.classList.contains("is-masked")) continue;
        const column = Number(pixel.dataset.column);
        maskedByColumn.set(column, (maskedByColumn.get(column) || 0) + 1);
      }
      assert.ok([...maskedByColumn.values()].every((count) => count === expectedRows));
    }
  }
});

test("low-beam tab uses only rows 5–8, with shorter and wider footprints", () => {
  const high = scene();
  const low = scene("?mode=low");
  assert.equal(low("highBeamTab").attributes["aria-current"], "false");
  assert.equal(low("lowBeamTab").attributes["aria-current"], "page");
  assert.equal(low("steeringControl").hidden, false);
  assert.equal(low("speedValue").textContent, "40");
  assert.equal(low("speedKmh").style["--speed-fill"], "33.3%");
  assert.equal(low("speedGainValue").textContent, "75% swivel response");
  assert.equal(low("steeringWheel").style["--wheel-angle"], "0deg");
  assert.equal(low("beamModeLabel").textContent, "LOW ONLY · SWIVEL ENABLED");
  assert.equal(low("lowBeamBase").children.length, 2);
  assert.equal(low("headlightBeams").children.length, 16);
  assert.equal(low("roadMaskReadout").textContent, "ADB mask inactive · low beam only");
  assert.ok(low("leftZoneStrip").children.every((button) => button.children[2].textContent === "LOW"));
  for (const side of ["left", "right"]) {
    assert.ok(low(`${side}HighPixels`).children.every((pixel) => !pixel.classList.contains("is-lit")));
    assert.ok(low(`${side}LowPixels`).children.every((pixel) => pixel.classList.contains("is-lit")));
    assert.match(low(`${side}MatrixState`).textContent, /32\/64 on/);
  }

  const points = (path) => [...path.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  const footprint = (get, side) => {
    const zones = get("headlightBeams").children.filter((zone) => zone.dataset.lamp === side);
    const first = points(zones[0].attributes.d);
    const last = points(zones.at(-1).attributes.d);
    const origin = first[0];
    const highEdge = first[1];
    const lowEdge = last.at(-1);
    const angle = (point) => Math.atan2(origin.x - point.x, origin.y - point.y) * 180 / Math.PI;
    return {
      reach: Math.hypot(highEdge.x - origin.x, highEdge.y - origin.y),
      span: angle(highEdge) - angle(lowEdge),
    };
  };
  for (const side of ["left", "right"]) {
    const highBeam = footprint(high, side);
    const lowBeam = footprint(low, side);
    assert.ok(lowBeam.reach < highBeam.reach * .5);
    assert.ok(lowBeam.span > highBeam.span);
  }
});

test("low-beam close-up enlarges the 40 m shine without clipping either swivel extreme", () => {
  const high = scene();
  const low = scene("?mode=low");
  const highView = high("beamField").attributes.viewBox.split(" ").map(Number);
  const lowView = low("beamField").attributes.viewBox.split(" ").map(Number);
  assert.ok(lowView[2] < highView[2]);
  assert.ok(lowView[3] < highView[3]);
  assert.match(low("fieldRangeSummary").textContent, /40 m shine · 60 m close-up/);
  assert.equal(low("rangeCap").textContent, "LOW BEAM · 40 m");
  assert.ok(low("gridDebugOverlay").attributes.transform?.startsWith("translate("));

  low("speedKmh").value = "0";
  low("speedKmh").trigger("input");
  for (const angle of ["-90", "90"]) {
    low("steeringAngle").value = angle;
    low("steeringAngle").trigger("input");
    for (const zone of low("headlightBeams").children) {
      for (const [, x, y] of zone.attributes.d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)) {
        assert.ok(Number(x) >= lowView[0] && Number(x) <= lowView[0] + lowView[2]);
        assert.ok(Number(y) >= lowView[1] && Number(y) <= lowView[1] + lowView[3]);
      }
    }
  }
});

test("steering swivels both low-beam footprints and matrices while high beam stays centered", () => {
  const low = scene("?mode=low");
  const lowRays = low("lampEmitters").children.map((emitter) => emitter.children[0]);
  const startRayX = lowRays.map((ray) => Number(ray.attributes.x2));
  const startFootprint = low("headlightBeams").children[0].attributes.d;
  const startLowWash = low("lowBeamBase").children.map((wash) => wash.attributes.d);
  low("speedKmh").value = "0";
  low("speedKmh").trigger("input");
  low("steeringAngle").value = "90";
  low("steeringAngle").trigger("input");
  assert.equal(low("steeringValue").textContent, "+90° · left");
  assert.equal(low("swivelValue").textContent, "L 2.0° · R 6.0°");
  assert.equal(low("steeringWheel").style["--wheel-angle"], "-90deg");
  assert.equal(low("leftMatrixFace").style["--swivel-angle"], "-2deg");
  assert.equal(low("rightMatrixFace").style["--swivel-angle"], "-6deg");
  assert.match(low("fieldDescription").textContent,
    /left matrix turns left by 2 degrees and the right matrix turns left by 6 degrees/);
  assert.notEqual(low("headlightBeams").children[0].attributes.d, startFootprint);
  assert.ok(low("lowBeamBase").children.every((wash, index) => wash.attributes.d !== startLowWash[index]));
  assert.ok(lowRays.every((ray, index) => Number(ray.attributes.x2) < startRayX[index]));
  assert.ok(low("leftLowPixels").children.every((pixel) => pixel.classList.contains("is-lit")));
  low("steeringAngle").value = "-90";
  low("steeringAngle").trigger("input");
  assert.equal(low("leftMatrixFace").style["--swivel-angle"], "6deg");
  assert.equal(low("rightMatrixFace").style["--swivel-angle"], "2deg");
  assert.equal(low("swivelValue").textContent, "L 6.0° · R 2.0°");
  assert.match(low("fieldDescription").textContent,
    /left matrix turns right by 6 degrees and the right matrix turns right by 2 degrees/);
  assert.ok(lowRays.every((ray, index) => Number(ray.attributes.x2) > startRayX[index]));

  const high = scene();
  const highFootprint = high("headlightBeams").children[0].attributes.d;
  const highLowWash = high("lowBeamBase").children.map((wash) => wash.attributes.d);
  high("steeringAngle").value = "90";
  high("steeringAngle").trigger("input");
  high("speedKmh").value = "120";
  high("speedKmh").trigger("input");
  assert.equal(high("leftMatrixFace").style["--swivel-angle"], "0deg");
  assert.equal(high("rightMatrixFace").style["--swivel-angle"], "0deg");
  assert.equal(high("headlightBeams").children[0].attributes.d, highFootprint);
  assert.ok(high("lowBeamBase").children.every((wash, index) => wash.attributes.d === highLowWash[index]));
  assert.ok(high("leftLowPixels").children.every((pixel) => pixel.classList.contains("is-lit")));
});

test("speed bar reduces low-beam swivel while the ego car stays fixed", () => {
  const get = scene("?mode=low");
  const carPosition = get("egoVehicle").attributes.transform;
  get("steeringAngle").value = "90";
  get("steeringAngle").trigger("input");
  const setSpeed = (speed) => {
    get("speedKmh").value = String(speed);
    get("speedKmh").trigger("input");
    return get("headlightBeams").children[0].attributes.d;
  };
  const slowPath = setSpeed(0);
  assert.equal(get("speedValue").textContent, "0");
  assert.equal(get("speedKmh").style["--speed-fill"], "0.0%");
  assert.equal(get("speedGainValue").textContent, "100% swivel response");
  assert.equal(get("leftMatrixFace").style["--swivel-angle"], "-2deg");
  assert.equal(get("rightMatrixFace").style["--swivel-angle"], "-6deg");
  const middlePath = setSpeed(60);
  assert.equal(get("speedValue").textContent, "60");
  assert.equal(get("speedKmh").style["--speed-fill"], "50.0%");
  assert.equal(get("speedGainValue").textContent, "63% swivel response");
  assert.equal(get("leftMatrixFace").style["--swivel-angle"], "-1.3deg");
  assert.equal(get("rightMatrixFace").style["--swivel-angle"], "-3.8deg");
  assert.notEqual(middlePath, slowPath);
  const fastPath = setSpeed(120);
  assert.equal(get("speedValue").textContent, "120");
  assert.equal(get("speedGainValue").textContent, "25% swivel response");
  assert.equal(get("leftMatrixFace").style["--swivel-angle"], "-0.5deg");
  assert.equal(get("rightMatrixFace").style["--swivel-angle"], "-1.5deg");
  assert.notEqual(fastPath, middlePath);
  assert.equal(get("egoVehicle").attributes.transform, carPosition);
});

test("low-beam column selection follows steering and stops at its beam range", () => {
  const get = scene("?mode=low");
  get("leftZoneStrip").children[3].trigger("click");
  assert.match(get("zoneFocusReadout").textContent, /10 m: .*20 m: .*40 m:/);
  assert.ok(get("sectorCells").children.some((cell) => cell.classList.contains("is-zone-covered")));
  assert.ok(get("sectorCells").children.every((cell) =>
    !cell.classList.contains("is-zone-covered") || Number(cell.dataset.band) < 4));
  const before = get("zoneFocusReadout").textContent;
  get("steeringAngle").value = "90";
  get("steeringAngle").trigger("input");
  assert.notEqual(get("zoneFocusReadout").textContent, before);
  assert.equal(get("zoneSelectionOutline").children.length, 1);
});

test("selecting a matrix column traces its colored footprint and highlights covered sectors", () => {
  const get = scene();
  const button = get("leftZoneStrip").children[3];
  button.trigger("click");
  assert.equal(button.attributes["aria-pressed"], "true");
  assert.equal(get("zoneSelectionOutline").children.length, 1);
  assert.match(get("zoneFocusReadout").textContent, /15 m: .*50 m: .*100 m:/);
  assert.ok(get("sectorCells").children.some((cell) => cell.classList.contains("is-zone-covered")));
  assert.ok(get("headlightBeams").children.some((zone) => zone.classList.contains("is-selected")));
  assert.ok([...get("leftHighPixels").children, ...get("leftLowPixels").children]
    .filter((pixel) => pixel.dataset.column === "3")
    .every((pixel) => pixel.classList.contains("is-selected")));
  button.trigger("click");
  assert.equal(button.attributes["aria-pressed"], "false");
  assert.equal(get("zoneSelectionOutline").children.length, 0);
  const matchingBeam = get("headlightBeams").children.find((zone) =>
    zone.dataset.lamp === "left" && zone.dataset.zone === "3");
  matchingBeam.trigger("click");
  assert.equal(button.attributes["aria-pressed"], "true");
});

test("larger configurable previews keep two 8x8 matrix lamps", () => {
  const get = scene("?maxRangeM=300&sectorCount=31");
  assert.equal(get("gridSectorCount").textContent, "31");
  assert.equal(get("headlightBeams").children.length, 16);
  assert.match(get("debugRange").textContent, /max 300 m/);
  get("rightZoneStrip").children[3].trigger("click");
  assert.match(get("zoneFocusReadout").textContent, /300 m:/);
});

test("dashboard labels and output follow configured wheel and speed limits", () => {
  const get = scene("?mode=low&maxSteeringWheelDeg=180&maxSpeedKmh=80&initialSpeedKmh=20");
  assert.equal(get("steeringAngle").max, "180");
  assert.equal(get("steeringLeftLimit").textContent, "+180° left");
  assert.equal(get("speedKmh").max, "80");
  assert.equal(get("speedValue").textContent, "20");
  assert.equal(get("speedMaxLabel").textContent, "80 km/h");
  get("steeringAngle").value = "180";
  get("steeringAngle").trigger("input");
  get("speedKmh").value = "80";
  get("speedKmh").trigger("input");
  assert.equal(get("swivelValue").textContent, "L 0.5° · R 1.5°");
});
