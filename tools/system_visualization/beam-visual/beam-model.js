/* Geometry for the explanatory two-headlamp ADB preview. Angles are positive to the left. */
(() => {
  "use strict";

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const toDegrees = (radians) => (radians * 180) / Math.PI;
  const MATRIX_SIZE = 8;
  const HIGH_BEAM_ROW_COUNT = 4;
  const LOW_BEAM_INSIDE_SWIVEL_RATIO = 1 / 3;
  const LOW_BEAM_MAX_SPEED_SWIVEL_RATIO = 0.25;
  // Preview rule: speed reduces the overall aim, and the inside lamp turns less.
  const lowBeamSwivelForInputs = (wheelDeg, speedKmh, maxWheelDeg, maxSpeedKmh, maxSwivelDeg) => {
    const steering = Math.max(-maxWheelDeg, Math.min(maxWheelDeg, wheelDeg));
    const speed = Math.max(0, Math.min(maxSpeedKmh, speedKmh));
    const speedRatio = speed / maxSpeedKmh;
    const gain = 1 - (1 - LOW_BEAM_MAX_SPEED_SWIVEL_RATIO) * speedRatio;
    const yawDeg = (steering / maxWheelDeg) * maxSwivelDeg * gain;
    const leftYawDeg = yawDeg > 0 ? yawDeg * LOW_BEAM_INSIDE_SWIVEL_RATIO : yawDeg;
    const rightYawDeg = yawDeg < 0 ? yawDeg * LOW_BEAM_INSIDE_SWIVEL_RATIO : yawDeg;
    return { yawDeg, leftYawDeg, rightYawDeg, gain };
  };
  // Provisional demo bands centred around the example distances 30/50/70/100 m.
  const highBeamRowsToMask = (distanceM) => {
    if (!Number.isFinite(distanceM) || distanceM <= 0) return 0;
    if (distanceM <= 40) return 4;
    if (distanceM <= 60) return 3;
    if (distanceM <= 85) return 2;
    return 1;
  };

  const createLamps = ({ vehicleWidthM, lampOffsetFraction, beamHalfAngleDeg,
    lampOutwardAimDeg, zonesPerLamp, zoneOverlapFraction }) => {
    const offsetM = vehicleWidthM * lampOffsetFraction;
    return [
      { side: "left", offsetM, aimDeg: lampOutwardAimDeg },
      { side: "right", offsetM: -offsetM, aimDeg: -lampOutwardAimDeg },
    ].map((lamp) => {
      const zoneWidthDeg = (2 * beamHalfAngleDeg) / zonesPerLamp;
      const overlapDeg = zoneWidthDeg * zoneOverlapFraction;
      return {
        ...lamp,
        zones: Array.from({ length: zonesPerLamp }, (_, index) => ({
          index,
          highDeg: lamp.aimDeg + beamHalfAngleDeg - index * zoneWidthDeg + overlapDeg / 2,
          lowDeg: lamp.aimDeg + beamHalfAngleDeg - (index + 1) * zoneWidthDeg - overlapDeg / 2,
        })),
      };
    });
  };

  const pointFromLamp = (lamp, rangeM, angleDeg) => ({
    forwardM: rangeM * Math.cos(toRadians(angleDeg)),
    leftM: lamp.offsetM + rangeM * Math.sin(toRadians(angleDeg)),
  });

  // A logical sector is centred on the vehicle. Project its lateral interval
  // from the reported object distance to each offset headlamp separately.
  const projectSectorToLamp = (lamp, sector, distanceM) => {
    const angleFromLamp = (angleDeg) => toDegrees(Math.atan2(
      distanceM * Math.tan(toRadians(angleDeg)) - lamp.offsetM,
      distanceM,
    ));
    return {
      highDeg: angleFromLamp(sector.highDeg),
      lowDeg: angleFromLamp(sector.lowDeg),
    };
  };

  const maskedRowsByColumnForSectors = (lamp, sectorDistancesM, sectorBoundsAt) => {
    const maskedRows = new Map();
    sectorDistancesM.forEach((distanceM, sectorIndex) => {
      if (!Number.isFinite(distanceM) || distanceM <= 0) return;
      const rowsToMask = highBeamRowsToMask(distanceM);
      if (!rowsToMask) return;
      const interval = projectSectorToLamp(
        lamp,
        sectorBoundsAt(sectorIndex, distanceM),
        distanceM,
      );
      for (const zone of lamp.zones) {
        if (interval.highDeg >= zone.lowDeg && interval.lowDeg <= zone.highDeg) {
          maskedRows.set(zone.index, Math.max(maskedRows.get(zone.index) || 0, rowsToMask));
        }
      }
    });
    return maskedRows;
  };

  const sectorsLitByZone = (lamp, zoneIndex, distanceM, sectorCount, sectorBoundsAt) => {
    const zone = lamp.zones[zoneIndex];
    const covered = [];
    for (let index = 0; index < sectorCount; index += 1) {
      const interval = projectSectorToLamp(lamp, sectorBoundsAt(index, distanceM), distanceM);
      if (interval.highDeg >= zone.lowDeg && interval.lowDeg <= zone.highDeg) {
        covered.push(index);
      }
    }
    return covered;
  };

  const matrixPixelState = (row, column, highBeamOn, maskedRowsByColumn) => {
    if (row >= HIGH_BEAM_ROW_COUNT) {
      return { beam: "low", lit: true, masked: false };
    }
    const masked = Boolean(highBeamOn && row < (maskedRowsByColumn.get(column) || 0));
    return { beam: "high", lit: Boolean(highBeamOn && !masked), masked };
  };

  const model = { createLamps, pointFromLamp, projectSectorToLamp, lowBeamSwivelForInputs,
    maskedRowsByColumnForSectors, highBeamRowsToMask, sectorsLitByZone,
    matrixPixelState, MATRIX_SIZE, HIGH_BEAM_ROW_COUNT };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  if (typeof window !== "undefined") window.AfsBeamModel = model;
})();
