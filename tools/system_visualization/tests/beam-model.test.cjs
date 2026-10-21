const assert = require("node:assert/strict");
const test = require("node:test");
const { createLamps, pointFromLamp, projectSectorToLamp, maskedRowsByColumnForSectors,
  highBeamRowsToMask, sectorsLitByZone, matrixPixelState, lowBeamSwivelForInputs, MATRIX_SIZE,
  HIGH_BEAM_ROW_COUNT } = require("../beam-visual/beam-model.js");

const lamps = createLamps({
  vehicleWidthM: 1.8,
  lampOffsetFraction: 0.235,
  beamHalfAngleDeg: 10,
  lampOutwardAimDeg: 2,
  zonesPerLamp: MATRIX_SIZE,
  zoneOverlapFraction: 0.15,
});
const sectors = Array.from({ length: 10 }, (_, index) => ({
  highDeg: 14.223 - index * 28.446 / 10,
  lowDeg: 14.223 - (index + 1) * 28.446 / 10,
}));
const sectorBoundsAt = (index) => sectors[index];

test("the two headlamps originate at separate points and overlap ahead", () => {
  assert.equal(lamps.length, 2);
  assert.equal(lamps[0].zones.length, MATRIX_SIZE);
  assert.equal(lamps[1].zones.length, MATRIX_SIZE);
  assert.equal(pointFromLamp(lamps[0], 0, 0).leftM, -pointFromLamp(lamps[1], 0, 0).leftM);
  const leftSpan = [lamps[0].zones.at(-1).lowDeg, lamps[0].zones[0].highDeg];
  const rightSpan = [lamps[1].zones.at(-1).lowDeg, lamps[1].zones[0].highDeg];
  assert.ok(leftSpan[0] < 0 && leftSpan[1] > 0);
  assert.ok(rightSpan[0] < 0 && rightSpan[1] > 0);
});

test("low-beam swivel turns the outside lamp farther and reduces aim as speed rises", () => {
  const yaw = (wheel, speed) => lowBeamSwivelForInputs(wheel, speed, 90, 120, 6);
  assert.deepEqual(yaw(90, 0), {
    yawDeg: 6, leftYawDeg: 2, rightYawDeg: 6, gain: 1,
  });
  assert.deepEqual(yaw(90, 60), {
    yawDeg: 3.75, leftYawDeg: 1.25, rightYawDeg: 3.75, gain: .625,
  });
  assert.deepEqual(yaw(90, 120), {
    yawDeg: 1.5, leftYawDeg: 0.5, rightYawDeg: 1.5, gain: .25,
  });
  assert.deepEqual(yaw(-90, 0), {
    yawDeg: -6, leftYawDeg: -6, rightYawDeg: -2, gain: 1,
  });
  assert.equal(yaw(-45, 60).yawDeg, -1.875);
  assert.equal(yaw(0, 120).yawDeg, 0);
  assert.equal(yaw(180, 200).yawDeg, 1.5);
});

test("a masked center vehicle selects columns in both lamp matrices", () => {
  const distances = Array(10).fill(Infinity);
  for (const index of [4, 5]) distances[index] = 55;
  for (const lamp of lamps) {
    const masked = maskedRowsByColumnForSectors(lamp, distances, sectorBoundsAt);
    assert.ok(masked.size > 0);
    assert.ok(masked.size < MATRIX_SIZE);
    assert.ok([...masked.values()].every((rows) => rows === 3));
  }
});

test("a vehicle in the left highway lane still masks columns on both matrices", () => {
  const distances = Array(10).fill(Infinity);
  for (const index of [2, 3, 4]) distances[index] = 30;
  const [left, right] = lamps.map((lamp) =>
    maskedRowsByColumnForSectors(lamp, distances, sectorBoundsAt));
  assert.ok(left.size > 0);
  assert.ok(right.size > 0);
  assert.notDeepEqual([...left.keys()], [...right.keys()]);
  assert.ok([...left.values(), ...right.values()].every((rows) => rows === 4));
});

test("the example distances map to progressively more top rows", () => {
  assert.deepEqual([100, 70, 50, 30].map(highBeamRowsToMask), [1, 2, 3, 4]);
  assert.deepEqual([110, 85, 60, 40].map(highBeamRowsToMask), [1, 2, 3, 4]);
  assert.equal(highBeamRowsToMask(Infinity), 0);
});

test("overlapping sector masks keep the larger row count from the nearer vehicle", () => {
  const distances = Array(10).fill(Infinity);
  distances[4] = 55;
  distances[5] = 30;
  for (const lamp of lamps) {
    const masked = maskedRowsByColumnForSectors(lamp, distances, sectorBoundsAt);
    assert.ok([...masked.values()].includes(3));
    assert.ok([...masked.values()].includes(4));
    assert.ok([...masked.values()].every((rows) => rows === 3 || rows === 4));
  }
});

test("an empty road requests no pixel masking", () => {
  for (const lamp of lamps) {
    assert.equal(
      maskedRowsByColumnForSectors(lamp, Array(10).fill(Infinity), sectorBoundsAt).size,
      0,
    );
  }
});

test("distance masks only the top requested rows and preserves the low-beam rows", () => {
  const maskedRowsByColumn = new Map([[2, 3], [3, 4]]);
  assert.deepEqual(matrixPixelState(0, 2, true, maskedRowsByColumn), {
    beam: "high", lit: false, masked: true,
  });
  assert.deepEqual(matrixPixelState(2, 2, true, maskedRowsByColumn), {
    beam: "high", lit: false, masked: true,
  });
  assert.deepEqual(matrixPixelState(3, 2, true, maskedRowsByColumn), {
    beam: "high", lit: true, masked: false,
  });
  assert.deepEqual(matrixPixelState(3, 3, true, maskedRowsByColumn), {
    beam: "high", lit: false, masked: true,
  });
  assert.deepEqual(matrixPixelState(3, 4, true, maskedRowsByColumn), {
    beam: "high", lit: true, masked: false,
  });
  assert.deepEqual(matrixPixelState(HIGH_BEAM_ROW_COUNT, 2, true, maskedRowsByColumn), {
    beam: "low", lit: true, masked: false,
  });
  assert.deepEqual(matrixPixelState(7, 3, false, maskedRowsByColumn), {
    beam: "low", lit: true, masked: false,
  });
  assert.deepEqual(matrixPixelState(1, 2, false, maskedRowsByColumn), {
    beam: "high", lit: false, masked: false,
  });
});

test("lamp offset changes the angle of a nearby logical sector", () => {
  const center = { highDeg: 1, lowDeg: -1 };
  const left = projectSectorToLamp(lamps[0], center, 5);
  const right = projectSectorToLamp(lamps[1], center, 5);
  assert.ok(left.highDeg < center.highDeg);
  assert.ok(right.lowDeg > center.lowDeg);
  assert.ok(Math.abs(left.highDeg - right.highDeg) > 5);
});

test("each matrix column reports the logical sectors its beam covers at a distance", () => {
  const leftAt15 = sectorsLitByZone(lamps[0], 3, 15, 10, sectorBoundsAt);
  const leftAt100 = sectorsLitByZone(lamps[0], 3, 100, 10, sectorBoundsAt);
  const rightAt15 = sectorsLitByZone(lamps[1], 3, 15, 10, sectorBoundsAt);
  assert.ok(leftAt15.length > 0);
  assert.ok(leftAt100.length > 0);
  assert.ok(rightAt15.length > 0);
  assert.notDeepEqual(leftAt15, rightAt15);
});
