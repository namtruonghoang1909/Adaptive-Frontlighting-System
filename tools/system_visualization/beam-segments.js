(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const defaults = {
    canvasWidthPx: 1000,
    canvasMarginPx: 20,
    topPaddingPx: 24,
    bottomPaddingPx: 38,
    maxPixelsPerMeter: 12,
    maxRangeM: 100,
    rangeBandSizeM: 10,
    nearFieldHalfAngleDeg: 18,
    // Former 16-sector grid boundaries 03..13: keep their far-field widths.
    farFieldHalfAngleDeg: 25 * (5 / 8) ** 1.2,
    sectorCount: 10,
    trimmedSectorsPerSide: 3,
    nearFieldRangeM: 30,
    blendWidthM: 20,
    farDistributionExponent: 1.2,
    pathSampleStepM: 2.5,
    pathSampleStepDeg: 2,
    maskSectorMargin: 1,
    beamHalfAngleDeg: 10,
    lampOutwardAimDeg: 2,
    lowBeamRangeM: 40,
    lowBeamHalfAngleDeg: 18,
    lowBeamOutwardAimDeg: 2,
    maxSwivelDeg: 6,
    maxSteeringWheelDeg: 90,
    maxSpeedKmh: 120,
    initialSpeedKmh: 40,
    lampOffsetFraction: 0.235,
    zonesPerLamp: 8,
    zoneOverlapFraction: 0.15,
    minVehicleRangeM: 5,
    vehicleLengthM: 4.5,
    vehicleWidthM: 1.8,
    laneWidthM: 3.5,
    sectorLabelRangeRatio: 0.9,
    rangeBoundaryToleranceM: 0.1,
    debugRangeOneM: 50,
    debugRangeTwoM: 100,
    leftVehicleRangeM: 30,
    centerVehicleRangeM: 55,
    rightVehicleRangeM: 80,
  };

  const numericConfigKeys = Object.keys(defaults);
  const query = new URLSearchParams(window.location.search);
  const isLowBeamVisual = query.get("mode") === "low";
  const suppliedConfig = window.AFS_BEAM_CONFIG && typeof window.AFS_BEAM_CONFIG === "object"
    ? window.AFS_BEAM_CONFIG
    : {};
  const config = { ...defaults };
  for (const key of numericConfigKeys) {
    const rawValue = query.has(key) ? query.get(key) : suppliedConfig[key];
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    const value = Number(rawValue);
    if (Number.isFinite(value)) config[key] = value;
  }

  const positiveKeys = [
    "canvasWidthPx", "canvasMarginPx", "topPaddingPx", "bottomPaddingPx",
    "maxPixelsPerMeter", "maxRangeM", "rangeBandSizeM", "blendWidthM",
    "farDistributionExponent", "pathSampleStepM",
    "pathSampleStepDeg", "beamHalfAngleDeg", "lowBeamRangeM",
    "lowBeamHalfAngleDeg", "maxSwivelDeg", "maxSteeringWheelDeg",
    "maxSpeedKmh", "minVehicleRangeM",
    "vehicleLengthM", "vehicleWidthM", "laneWidthM", "sectorLabelRangeRatio",
  ];
  for (const key of positiveKeys) {
    if (config[key] <= 0) config[key] = defaults[key];
  }
  config.sectorCount = Math.max(1, Math.floor(config.sectorCount));
  config.trimmedSectorsPerSide = Math.max(0, Math.floor(config.trimmedSectorsPerSide));
  config.zonesPerLamp = Math.max(1, Math.floor(config.zonesPerLamp));
  config.maskSectorMargin = Math.max(0, Math.floor(config.maskSectorMargin));
  config.nearFieldHalfAngleDeg = Math.min(89, Math.max(0.01, config.nearFieldHalfAngleDeg));
  config.farFieldHalfAngleDeg = Math.min(
    config.nearFieldHalfAngleDeg,
    Math.max(0.01, config.farFieldHalfAngleDeg),
  );
  config.nearFieldRangeM = Math.max(0, config.nearFieldRangeM);
  config.sectorLabelRangeRatio = Math.min(1, Math.max(0.01, config.sectorLabelRangeRatio));
  config.debugRangeOneM = Math.max(0, config.debugRangeOneM);
  config.debugRangeTwoM = Math.max(0, config.debugRangeTwoM);
  config.rangeBoundaryToleranceM = Math.max(0, config.rangeBoundaryToleranceM);
  config.beamHalfAngleDeg = Math.min(44, Math.max(0.01, config.beamHalfAngleDeg));
  config.lowBeamHalfAngleDeg = Math.min(
    45, Math.max(config.beamHalfAngleDeg + 1, config.lowBeamHalfAngleDeg),
  );
  config.lampOutwardAimDeg = Math.max(0, Math.min(
    config.beamHalfAngleDeg * 0.75, config.lampOutwardAimDeg,
  ));
  config.lowBeamOutwardAimDeg = Math.max(0, Math.min(
    config.lowBeamHalfAngleDeg * 0.75, config.lowBeamOutwardAimDeg,
  ));
  config.maxSwivelDeg = Math.max(1, Math.min(25, Math.round(config.maxSwivelDeg)));
  config.maxSteeringWheelDeg = Math.max(10, Math.min(540, Math.round(config.maxSteeringWheelDeg)));
  config.maxSpeedKmh = Math.max(10, Math.min(300, Math.round(config.maxSpeedKmh)));
  config.initialSpeedKmh = Math.max(0, Math.min(
    config.maxSpeedKmh, Math.round(config.initialSpeedKmh),
  ));
  config.lampOffsetFraction = Math.max(0, Math.min(0.5, config.lampOffsetFraction));
  config.zoneOverlapFraction = Math.max(0, Math.min(0.4, config.zoneOverlapFraction));
  config.canvasMarginPx = Math.min(config.canvasMarginPx, config.canvasWidthPx * 0.49);

  const { maxRangeM, rangeBandSizeM, sectorCount } = config;
  const lowBeamRangeM = Math.min(config.lowBeamRangeM, maxRangeM * 0.6);
  const beamRangeM = isLowBeamVisual ? lowBeamRangeM : maxRangeM;
  const beamModel = window.AfsBeamModel;
  if (!beamModel) return;
  const highLamps = beamModel.createLamps(config);
  const lowLamps = beamModel.createLamps({
    ...config,
    beamHalfAngleDeg: config.lowBeamHalfAngleDeg,
    lampOutwardAimDeg: config.lowBeamOutwardAimDeg,
  });
  const lamps = isLowBeamVisual ? lowLamps : highLamps;
  for (const lamp of lowLamps) {
    lamp.centerAimDeg = lamp.aimDeg;
    for (const zone of lamp.zones) {
      zone.centerHighDeg = zone.highDeg;
      zone.centerLowDeg = zone.lowDeg;
    }
  }
  const lowLampBySide = Object.fromEntries(lowLamps.map((lamp) => [lamp.side, lamp]));
  const centerX = config.canvasWidthPx / 2;
  const basePixelsPerMeter = 6.5;
  const vehicles = [
    {
      lane: "left", forwardId: "leftRange", visibleId: "leftVisible", valueId: "leftValue",
      readoutId: "leftReadout", minLabelId: "leftMinLabel", maxLabelId: "leftMaxLabel",
      laneOffsetId: "leftLaneOffset", initialRangeM: config.leftVehicleRangeM, laneFactor: 1,
    },
    {
      lane: "center", forwardId: "centerRange", visibleId: "centerVisible", valueId: "centerValue",
      readoutId: "centerReadout", minLabelId: "centerMinLabel", maxLabelId: "centerMaxLabel",
      laneOffsetId: "centerLaneOffset", initialRangeM: config.centerVehicleRangeM, laneFactor: 0,
    },
    {
      lane: "right", forwardId: "rightRange", visibleId: "rightVisible", valueId: "rightValue",
      readoutId: "rightReadout", minLabelId: "rightMinLabel", maxLabelId: "rightMaxLabel",
      laneOffsetId: "rightLaneOffset", initialRangeM: config.rightVehicleRangeM, laneFactor: -1,
    },
  ].map((vehicle) => ({
    ...vehicle,
    forwardInput: document.getElementById(vehicle.forwardId),
    visibleInput: document.getElementById(vehicle.visibleId),
  }));

  const elementIds = [
    "beamField", "fieldBackdrop", "roadSurface", "roadEdges", "laneDividers",
    "rangeCap", "headlightBeams", "sectorCells", "gridLines", "rangeLabels",
    "sectorLabels", "testVehicles", "egoVehicle", "egoCarLabel", "beamModeLabel",
    "highBeamTab", "lowBeamTab", "beamTitle", "beamLede", "fieldTitle",
    "topbarGridSummary", "fieldSpanSummary", "fieldRangeSummary",
    "fieldDescription", "rangeBandCaption", "beamRangeCaption", "vehicleSizeCaption",
    "maskDimCaption", "gridSectorCount", "physicalZoneCount", "lampZoneSpec",
    "lampMaskReadout", "roadMaskReadout", "leftZoneStrip", "rightZoneStrip",
    "zoneFocusReadout", "lampEmitters", "lowBeamBase", "zoneSelectionOutline",
    "leftHighPixels", "leftLowPixels", "rightHighPixels", "rightLowPixels",
    "leftMatrixState", "rightMatrixState", "leftMatrixFace", "rightMatrixFace",
    "gridAngularSpan", "gridRangeSpec", "gridDimSpec", "logicalSectorCount",
    "beamFootprintCaption", "mappingTitle", "mappingDescription",
    "controlEyebrow", "controlTitle", "controlDescription",
    "steeringControl", "steeringAngle", "steeringValue", "steeringWheel",
    "steeringRightLimit", "steeringLeftLimit", "speedKmh", "speedValue",
    "speedMaxLabel", "speedGainValue",
    "swivelValue", "swivelRule",
    "gridDebugOverlay", "debugOverlayBackground", "debugAngles", "debugRange", "debugWidthFirst",
    "debugWidthSecond", "debugMask",
    ...vehicles.flatMap(({ valueId, readoutId, minLabelId, maxLabelId, laneOffsetId }) => [
      valueId, readoutId, minLabelId, maxLabelId, laneOffsetId,
    ]),
  ];
  const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));
  if (Object.values(elements).some((element) => !element)
    || vehicles.some(({ forwardInput, visibleInput }) => !forwardInput || !visibleInput)) return;

  const field = elements.beamField;
  const cellLayer = elements.sectorCells;
  const lineLayer = elements.gridLines;
  const rangeLabelLayer = elements.rangeLabels;
  const sectorLabelLayer = elements.sectorLabels;
  const vehicleLayer = elements.testVehicles;
  const highBeamOn = !isLowBeamVisual;
  elements.highBeamTab.setAttribute("aria-current", highBeamOn ? "page" : "false");
  elements.lowBeamTab.setAttribute("aria-current", isLowBeamVisual ? "page" : "false");
  elements.steeringControl.hidden = highBeamOn;
  elements.steeringAngle.min = String(-config.maxSteeringWheelDeg);
  elements.steeringAngle.max = String(config.maxSteeringWheelDeg);
  elements.steeringAngle.value = "0";
  elements.steeringRightLimit.textContent = `−${config.maxSteeringWheelDeg}° right`;
  elements.steeringLeftLimit.textContent = `+${config.maxSteeringWheelDeg}° left`;
  elements.speedKmh.min = "0";
  elements.speedKmh.max = String(config.maxSpeedKmh);
  elements.speedKmh.value = String(config.initialSpeedKmh);
  elements.speedMaxLabel.textContent = `${config.maxSpeedKmh} km/h`;
  document.title = isLowBeamVisual ? "AFS · Low beam visual" : "AFS · High beam visual";
  field.classList.toggle("high-beam-on", highBeamOn);
  field.classList.toggle("low-beam-on", isLowBeamVisual);
  const zoneControls = new Map();
  const matrixPixels = [];
  let selectedZone = null;
  const zoneKey = (side, index) => `${side}:${index}`;
  const zoneColor = (side, index) => {
    const fraction = index / Math.max(1, config.zonesPerLamp - 1);
    const hue = side === "left" ? 5 + 160 * fraction : 195 + 140 * fraction;
    return `hsl(${hue.toFixed(1)} 95% 70%)`;
  };
  const sampledValues = (start, end, step) => {
    if (start === end) return [start];
    const count = Math.max(1, Math.ceil(Math.abs(end - start) / step));
    return Array.from({ length: count + 1 }, (_, index) => start + ((end - start) * index) / count);
  };

  const fieldHalfAngleAt = (distanceM) => {
    const blendStart = config.nearFieldRangeM;
    const blendEnd = blendStart + config.blendWidthM;
    const blend = Math.min(1, Math.max(0, (distanceM - blendStart) / (blendEnd - blendStart)));
    const smoothBlend = blend * blend * (3 - 2 * blend);
    return config.nearFieldHalfAngleDeg
      + (config.farFieldHalfAngleDeg - config.nearFieldHalfAngleDeg) * smoothBlend;
  };

  const farBoundaryAngle = (boundaryIndex) => {
    const fullCount = sectorCount + 2 * config.trimmedSectorsPerSide;
    const normalized = 1 - (2 * (boundaryIndex + config.trimmedSectorsPerSide)) / fullCount;
    const edgeNormalized = sectorCount / fullCount;
    const powered = Math.sign(normalized) * Math.abs(normalized) ** config.farDistributionExponent;
    return config.farFieldHalfAngleDeg * powered
      / edgeNormalized ** config.farDistributionExponent;
  };

  const sectorBoundaryAngle = (boundaryIndex, distanceM) => {
    const isFieldEdge = boundaryIndex === 0 || boundaryIndex === sectorCount;
    if (!isFieldEdge) return farBoundaryAngle(boundaryIndex);
    return Math.sign(1 - (2 * boundaryIndex) / sectorCount) * fieldHalfAngleAt(distanceM);
  };

  const sectorBounds = (index, distanceM) => ({
    highDeg: sectorBoundaryAngle(index, distanceM),
    lowDeg: sectorBoundaryAngle(index + 1, distanceM),
  });

  const blendEndM = config.nearFieldRangeM + config.blendWidthM;
  const extentAtDistance = (distanceM) => {
    const fieldAngle = distanceM <= blendEndM
      ? config.nearFieldHalfAngleDeg
      : config.farFieldHalfAngleDeg;
    return config.vehicleWidthM * config.lampOffsetFraction + distanceM * Math.sin(
      (Math.max(fieldAngle, config.beamHalfAngleDeg) * Math.PI) / 180,
    );
  };
  let maximumLateralExtentM = 0;
  const fitDistances = new Set([
    ...sampledValues(0, maxRangeM, config.pathSampleStepM),
    Math.min(maxRangeM, config.nearFieldRangeM),
    Math.min(maxRangeM, blendEndM),
  ]);
  for (const distanceM of fitDistances) {
    maximumLateralExtentM = Math.max(maximumLateralExtentM, extentAtDistance(distanceM));
  }
  const availableHalfWidthPx = (config.canvasWidthPx - 2 * config.canvasMarginPx) / 2;
  const pixelsPerMeter = Math.min(
    config.maxPixelsPerMeter,
    availableHalfWidthPx / maximumLateralExtentM,
  );
  const originY = config.topPaddingPx + maxRangeM * pixelsPerMeter;
  const viewHeight = originY
    + config.vehicleLengthM * pixelsPerMeter
    + config.bottomPaddingPx;
  const lowViewRangeM = Math.min(
    maxRangeM,
    Math.max(lowBeamRangeM * 1.5, lowBeamRangeM + rangeBandSizeM),
  );
  const lowBeamExtentPx = Math.max(...lowLamps.map((lamp) => {
    const angleLow = lamp.zones.at(-1).lowDeg - config.maxSwivelDeg;
    const angleHigh = lamp.zones[0].highDeg + config.maxSwivelDeg;
    return Math.max(...sampledValues(angleLow, angleHigh, config.pathSampleStepDeg)
      .map((angleDeg) => Math.abs(
        lamp.offsetM + lowBeamRangeM * Math.sin((angleDeg * Math.PI) / 180),
      ) * pixelsPerMeter));
  }));
  const lowViewWidthPx = Math.min(config.canvasWidthPx, Math.max(
    config.canvasWidthPx * 0.8,
    2 * (lowBeamExtentPx + config.canvasMarginPx),
  ));
  const lowViewX = (config.canvasWidthPx - lowViewWidthPx) / 2;
  const lowViewY = originY - lowViewRangeM * pixelsPerMeter - config.topPaddingPx;
  const lowViewHeight = viewHeight - lowViewY;

  const rangesM = [0];
  for (let rangeM = rangeBandSizeM; rangeM < maxRangeM; rangeM += rangeBandSizeM) {
    rangesM.push(rangeM);
  }
  rangesM.push(maxRangeM);

  const makeSvg = (tag, attributes = {}) => {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, String(value));
    }
    return element;
  };

  const polarPoint = (radiusM, angleDeg) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const radius = radiusM * pixelsPerMeter;
    return {
      x: centerX - radius * Math.sin(angleRad),
      y: originY - radius * Math.cos(angleRad),
    };
  };

  const pointForEgo = (forwardM, leftM) => ({
    x: centerX - leftM * pixelsPerMeter,
    y: originY - forwardM * pixelsPerMeter,
  });

  const angleForEgo = (forwardM, leftM) =>
    (Math.atan2(leftM, forwardM) * 180) / Math.PI;

  const pointPath = (points, close = false) => {
    if (!points.length) return "";
    const path = [`M ${points[0].x} ${points[0].y}`];
    for (const point of points.slice(1)) path.push(`L ${point.x} ${point.y}`);
    if (close) path.push("Z");
    return path.join(" ");
  };

  const sectorPath = (innerM, outerM, highAngleDeg, lowAngleDeg) => {
    const highBoundary = () => highAngleDeg;
    const lowBoundary = () => lowAngleDeg;
    const highEdge = sampledValues(innerM, outerM, config.pathSampleStepM)
      .map((distanceM) => polarPoint(distanceM, highBoundary(distanceM)));
    const outerAngles = sampledValues(highAngleDeg, lowAngleDeg, config.pathSampleStepDeg);
    const outerArc = outerAngles.slice(1).map((angle) => polarPoint(outerM, angle));
    const lowEdge = sampledValues(innerM, outerM, config.pathSampleStepM)
      .reverse()
      .map((distanceM) => polarPoint(distanceM, lowBoundary(distanceM)));
    const points = innerM === 0
      ? [polarPoint(0, 0), ...highEdge.slice(1), ...outerArc, ...lowEdge.slice(0, -1)]
      : [
        ...highEdge,
        ...outerArc,
        ...lowEdge.slice(1),
        ...sampledValues(lowBoundary(innerM), highBoundary(innerM), config.pathSampleStepDeg)
          .slice(1, -1)
          .map((angle) => polarPoint(innerM, angle)),
      ];
    return pointPath(points, true);
  };

  const sectorArcPath = (distanceM, startDeg, endDeg) => pointPath(
    sampledValues(startDeg, endDeg, config.pathSampleStepDeg)
      .map((angle) => polarPoint(distanceM, angle)),
  );

  const sectorAt = (angleDeg, distanceM) => {
    const halfAngle = fieldHalfAngleAt(distanceM);
    if (angleDeg > halfAngle || angleDeg < -halfAngle) return null;
    for (let index = 0; index < sectorCount; index += 1) {
      const { highDeg, lowDeg } = sectorBounds(index, distanceM);
      if (angleDeg <= highDeg && angleDeg >= lowDeg) return index;
    }
    return angleDeg >= 0 ? 0 : sectorCount - 1;
  };

  const effectiveCellWidthsAt = (distanceM) => {
    const widths = Array.from({ length: sectorCount }, (_, index) => {
      const { highDeg, lowDeg } = sectorBounds(index, distanceM);
      return distanceM * (
        Math.tan((highDeg * Math.PI) / 180) - Math.tan((lowDeg * Math.PI) / 180)
      );
    });
    const centerWidth = widths[Math.floor(sectorCount / 2)];
    return { centerWidth, minWidth: Math.min(...widths), maxWidth: Math.max(...widths) };
  };

  const formatSector = (index) => String(index).padStart(Math.max(2, String(sectorCount - 1).length), "0");
  const formatMeters = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  const formatHalfAngle = (angle) => `±${formatMeters(Math.abs(angle))}°`;
  const bandIndexAt = (distanceM) => {
    for (let band = 0; band < rangesM.length - 1; band += 1) {
      if (distanceM <= rangesM[band + 1]) return band;
    }
    return rangesM.length - 2;
  };

  const transitionOpacityAt = (distanceM) => {
    if (distanceM <= config.nearFieldRangeM) return 1;
    if (config.blendWidthM <= 0 || distanceM >= blendEndM) return 0;
    const blend = (distanceM - config.nearFieldRangeM) / config.blendWidthM;
    const smoothBlend = blend * blend * (3 - 2 * blend);
    return 1 - smoothBlend;
  };

  const setText = (id, value) => { elements[id].textContent = value; };
  const setAttribute = (element, name, value) => element.setAttribute(name, String(value));
  const laneCenterLeftM = (factor) => factor * config.laneWidthM;
  const leftEdgeM = -1.5 * config.laneWidthM;
  const rightEdgeM = 1.5 * config.laneWidthM;
  const roadStartM = -config.vehicleLengthM;
  const roadEndM = maxRangeM;
  const roadCorners = [
    pointForEgo(roadStartM, leftEdgeM),
    pointForEgo(roadEndM, leftEdgeM),
    pointForEgo(roadEndM, rightEdgeM),
    pointForEgo(roadStartM, rightEdgeM),
  ];
  elements.fieldBackdrop.setAttribute("width", config.canvasWidthPx);
  elements.fieldBackdrop.setAttribute("height", viewHeight);
  field.setAttribute("viewBox", isLowBeamVisual
    ? `${lowViewX} ${lowViewY} ${lowViewWidthPx} ${lowViewHeight}`
    : `0 0 ${config.canvasWidthPx} ${viewHeight}`);
  if (isLowBeamVisual) {
    elements.gridDebugOverlay.setAttribute(
      "transform",
      `translate(${lowViewX} ${lowViewY}) scale(${lowViewWidthPx / config.canvasWidthPx})`,
    );
  }
  elements.roadSurface.setAttribute("d", pointPath(roadCorners, true));
  elements.roadEdges.setAttribute("d", [
    pointPath([pointForEgo(roadStartM, leftEdgeM), pointForEgo(roadEndM, leftEdgeM)]),
    pointPath([pointForEgo(roadStartM, rightEdgeM), pointForEgo(roadEndM, rightEdgeM)]),
  ].join(" "));
  elements.laneDividers.setAttribute("d", [-0.5, 0.5]
    .map((factor) => pointPath([
      pointForEgo(roadStartM, factor * config.laneWidthM),
      pointForEgo(roadEndM, factor * config.laneWidthM),
    ]))
    .join(" "));

  const rangeCapPoint = polarPoint(beamRangeM, 0);
  setAttribute(elements.rangeCap, "x", centerX);
  setAttribute(elements.rangeCap, "y", rangeCapPoint.y - 7);
  elements.rangeCap.textContent = isLowBeamVisual
    ? `LOW BEAM · ${formatMeters(lowBeamRangeM)} m`
    : `MAX RANGE · ${formatMeters(maxRangeM)} m`;

  const lampPoint = (lamp, rangeM, angleDeg) => {
    const point = beamModel.pointFromLamp(lamp, rangeM, angleDeg);
    return pointForEgo(point.forwardM, point.leftM);
  };
  const lampZonePath = (lamp, zone, rangeM = beamRangeM) => pointPath([
    lampPoint(lamp, 0, 0),
    ...sampledValues(zone.highDeg, zone.lowDeg, config.pathSampleStepDeg)
      .map((angleDeg) => lampPoint(lamp, rangeM, angleDeg)),
  ], true);
  const lampBySide = Object.fromEntries(lamps.map((lamp) => [lamp.side, lamp]));
  for (const lamp of lamps) {
    const lowLamp = lowLampBySide[lamp.side];
    elements.lowBeamBase.append(makeSvg("path", {
      class: "low-beam-wash",
      "data-lamp": lamp.side,
      d: lampZonePath(lowLamp, {
        highDeg: lowLamp.zones[0].highDeg,
        lowDeg: lowLamp.zones.at(-1).lowDeg,
      }, lowBeamRangeM),
    }));
    elements[`${lamp.side}ZoneStrip`].style.setProperty(
      "--zone-columns", String(config.zonesPerLamp),
    );
    const origin = lampPoint(lamp, 0, 0);
    const rayEnd = lampPoint(lamp, Math.min(maxRangeM, 12), lamp.aimDeg);
    const marker = makeSvg("g", { class: `lamp-emitter lamp-${lamp.side}`, "data-lamp": lamp.side });
    marker.style.setProperty("--source-color", lamp.side === "left" ? "#ffbf68" : "#8cc8ff");
    marker.append(
      makeSvg("line", {
        class: "lamp-source-ray", x1: origin.x, y1: origin.y,
        x2: rayEnd.x, y2: rayEnd.y,
      }),
      makeSvg("circle", { class: "lamp-source-halo", cx: origin.x, cy: origin.y, r: 3.3 }),
      makeSvg("circle", { class: "lamp-source-dot", cx: origin.x, cy: origin.y, r: 1.8 }),
    );
    const labelX = origin.x + (lamp.side === "left" ? -29 : 29);
    const labelY = origin.y + 6;
    const label = makeSvg("text", {
      class: "lamp-source-label", x: labelX, y: labelY, "text-anchor": "middle",
    });
    label.textContent = lamp.side === "left" ? "L SOURCE" : "R SOURCE";
    marker.append(label);
    elements.lampEmitters.append(marker);

    for (const zone of lamp.zones) {
      const key = zoneKey(lamp.side, zone.index);
      const color = zoneColor(lamp.side, zone.index);
      const toggleFocus = () => {
        selectedZone = selectedZone === key ? null : key;
        updateScene();
      };
      const path = makeSvg("path", {
        class: `lamp-zone lamp-${lamp.side}`,
        "data-lamp": lamp.side,
        "data-zone": zone.index,
        d: lampZonePath(lamp, zone, beamRangeM),
      });
      path.style.setProperty("--zone-color", color);
      path.addEventListener("click", toggleFocus);
      elements.headlightBeams.append(path);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "zone-button";
      button.setAttribute("data-lamp", lamp.side);
      button.setAttribute("data-zone", zone.index);
      button.setAttribute("aria-pressed", "false");
      button.style.setProperty("--zone-color", color);
      const swatch = document.createElement("span");
      swatch.className = "zone-button-swatch";
      const name = document.createElement("strong");
      name.textContent = `${lamp.side === "left" ? "L" : "R"}${zone.index}`;
      const level = document.createElement("small");
      level.textContent = "100%";
      button.append(swatch, name, level);
      button.addEventListener("click", toggleFocus);
      elements[`${lamp.side}ZoneStrip`].append(button);
      zoneControls.set(key, { button, level, lamp, zone, color });
    }

    for (let row = 0; row < beamModel.MATRIX_SIZE; row += 1) {
      for (let column = 0; column < beamModel.MATRIX_SIZE; column += 1) {
        const pixel = document.createElement("span");
        pixel.className = `matrix-pixel ${row < beamModel.HIGH_BEAM_ROW_COUNT ? "is-high" : "is-low"}`;
        pixel.setAttribute("data-lamp", lamp.side);
        pixel.setAttribute("data-row", row);
        pixel.setAttribute("data-column", column);
        pixel.style.setProperty("--zone-color", zoneColor(lamp.side, column));
        pixel.title = `${lamp.side} matrix row ${row + 1}, column ${column + 1} · ${row < beamModel.HIGH_BEAM_ROW_COUNT ? "high-beam extension" : "low-beam base"}`;
        elements[`${lamp.side}${row < beamModel.HIGH_BEAM_ROW_COUNT ? "High" : "Low"}Pixels`]
          .append(pixel);
        matrixPixels.push({ pixel, lamp, row, column });
      }
    }
  }

  const bandCount = rangesM.length - 1;
  for (let band = 0; band < bandCount; band += 1) {
    for (let index = 0; index < sectorCount; index += 1) {
      cellLayer.append(makeSvg("path", {
        class: `grid-cell band-${band % 2 === 0 ? "even" : "odd"}`,
        "data-sector": index,
        "data-band": band,
        d: sectorPath(
          rangesM[band],
          rangesM[band + 1],
          farBoundaryAngle(index),
          farBoundaryAngle(index + 1),
        ),
      }));
    }
  }

  const nearWingEndM = Math.min(maxRangeM, blendEndM);
  const nearWingSides = [
    { index: 0, highDeg: config.nearFieldHalfAngleDeg, lowDeg: farBoundaryAngle(0) },
    {
      index: sectorCount - 1,
      highDeg: farBoundaryAngle(sectorCount),
      lowDeg: -config.nearFieldHalfAngleDeg,
    },
  ];
  for (let band = 0; band < bandCount; band += 1) {
    const innerM = rangesM[band];
    const outerM = Math.min(rangesM[band + 1], nearWingEndM);
    if (innerM >= outerM) continue;
    const radialCuts = sampledValues(innerM, outerM, config.pathSampleStepM);
    for (const side of nearWingSides) {
      for (let cut = 0; cut < radialCuts.length - 1; cut += 1) {
        const sliceInnerM = radialCuts[cut];
        const sliceOuterM = radialCuts[cut + 1];
        const opacity = transitionOpacityAt((sliceInnerM + sliceOuterM) / 2);
        if (opacity <= 0) continue;
        cellLayer.append(makeSvg("path", {
          class: `grid-cell near-field-wing band-${band % 2 === 0 ? "even" : "odd"}`,
          "data-sector": side.index,
          "data-band": band,
          "data-range-start": sliceInnerM,
          "data-range-end": sliceOuterM,
          opacity: opacity.toFixed(3),
          d: sectorPath(sliceInnerM, sliceOuterM, side.highDeg, side.lowDeg),
        }));
      }
    }
  }

  for (let index = 0; index <= sectorCount; index += 1) {
    const point = polarPoint(maxRangeM, farBoundaryAngle(index));
    lineLayer.append(makeSvg("line", {
      class: "grid-ray",
      "data-boundary": index,
      x1: centerX,
      y1: originY,
      x2: point.x,
      y2: point.y,
    }));
  }

  for (const rangeM of rangesM.slice(1)) {
    const wholeArc = sectorArcPath(
      rangeM,
      farBoundaryAngle(0),
      farBoundaryAngle(sectorCount),
    );
    lineLayer.append(makeSvg("path", {
      class: "range-arc",
      "data-range": rangeM,
      d: wholeArc,
    }));
    const labelPoint = polarPoint(rangeM, 0);
    const label = makeSvg("text", {
      class: "range-label",
      x: labelPoint.x + config.canvasWidthPx * 0.009,
      y: labelPoint.y + config.canvasWidthPx * 0.012,
    });
    label.textContent = `${formatMeters(rangeM)} m`;
    rangeLabelLayer.append(label);
  }

  const sectorLabelDistance = isLowBeamVisual
    ? Math.min(maxRangeM, Math.max(lowBeamRangeM * 1.1, lowViewRangeM * 0.9))
    : maxRangeM * config.sectorLabelRangeRatio;
  const sectorLabelWidthPx = effectiveCellWidthsAt(sectorLabelDistance).centerWidth * pixelsPerMeter;
  const sectorLabelDigits = formatSector(sectorCount - 1).length;
  const sectorLabelFontSize = Math.max(
    5.5,
    Math.min(9, sectorLabelWidthPx / (sectorLabelDigits * 0.72)),
  );
  for (let index = 0; index < sectorCount; index += 1) {
    const highDeg = farBoundaryAngle(index);
    const lowDeg = farBoundaryAngle(index + 1);
    const point = polarPoint(sectorLabelDistance, (highDeg + lowDeg) / 2);
    const label = makeSvg("text", {
      class: "sector-label",
      "data-sector-label": index,
      x: point.x,
      y: point.y,
    });
    label.textContent = formatSector(index);
    label.style.setProperty("font-size", `${sectorLabelFontSize.toFixed(2)}px`);
    sectorLabelLayer.append(label);
  }

  const egoScale = pixelsPerMeter / basePixelsPerMeter;
  elements.egoVehicle.setAttribute(
    "transform",
    `translate(${centerX} ${originY}) scale(${egoScale}) translate(${-centerX} ${-930})`,
  );
  const egoCarBottom = originY + config.vehicleLengthM * pixelsPerMeter;
  setAttribute(elements.egoCarLabel, "x", centerX);
  setAttribute(elements.egoCarLabel, "y", egoCarBottom + config.canvasWidthPx * 0.018);
  const carWidthPx = config.vehicleWidthM * pixelsPerMeter;
  const carLengthPx = config.vehicleLengthM * pixelsPerMeter;
  const halfCarWidth = carWidthPx / 2;
  const halfCarLength = carLengthPx / 2;
  const carBodyPath = `M ${-halfCarWidth} ${halfCarLength} L ${-halfCarWidth} ${-halfCarLength + pixelsPerMeter * 0.75} Q ${-halfCarWidth} ${-halfCarLength + pixelsPerMeter * 0.15} ${-halfCarWidth + pixelsPerMeter * 0.25} ${-halfCarLength} H ${halfCarWidth - pixelsPerMeter * 0.25} Q ${halfCarWidth} ${-halfCarLength + pixelsPerMeter * 0.15} ${halfCarWidth} ${-halfCarLength + pixelsPerMeter * 0.75} L ${halfCarWidth} ${halfCarLength} Z`;

  const makeTargetVehicle = (vehicle, forwardM, leftM) => {
    const corners = [
      [forwardM - config.vehicleLengthM / 2, leftM - config.vehicleWidthM / 2],
      [forwardM - config.vehicleLengthM / 2, leftM + config.vehicleWidthM / 2],
      [forwardM + config.vehicleLengthM / 2, leftM + config.vehicleWidthM / 2],
      [forwardM + config.vehicleLengthM / 2, leftM - config.vehicleWidthM / 2],
    ];
    const footprintPoints = corners.map(([forward, left]) => {
      const point = pointForEgo(forward, left);
      return `${point.x},${point.y}`;
    });
    const centerPoint = pointForEgo(forwardM, leftM);
    const group = makeSvg("g", {
      class: "test-vehicle",
      "data-lane": vehicle.lane,
      "data-forward": forwardM,
      "data-left": leftM,
    });
    group.append(
      makeSvg("polygon", { class: "target-footprint", points: footprintPoints.join(" ") }),
      makeSvg("line", {
        class: "target-center-line",
        x1: pointForEgo(forwardM - config.vehicleLengthM / 2, leftM).x,
        y1: pointForEgo(forwardM - config.vehicleLengthM / 2, leftM).y,
        x2: pointForEgo(forwardM + config.vehicleLengthM / 2, leftM).x,
        y2: pointForEgo(forwardM + config.vehicleLengthM / 2, leftM).y,
      }),
    );

    const car = makeSvg("g", {
      class: "target-car",
      transform: `translate(${centerPoint.x} ${centerPoint.y})`,
    });
    car.append(
      makeSvg("path", { class: "target-car-body", d: carBodyPath }),
      makeSvg("path", {
        class: "target-glass",
        d: `M ${-halfCarWidth + pixelsPerMeter * 0.2} ${-halfCarLength + pixelsPerMeter * 1.1} Q 0 ${-halfCarLength + pixelsPerMeter * 0.85} ${halfCarWidth - pixelsPerMeter * 0.2} ${-halfCarLength + pixelsPerMeter * 1.1} L ${halfCarWidth - pixelsPerMeter * 0.25} ${-halfCarLength + pixelsPerMeter * 2} H ${-halfCarWidth + pixelsPerMeter * 0.25} Z`,
      }),
      makeSvg("path", {
        class: "target-roof",
        d: `M ${-halfCarWidth + pixelsPerMeter * 0.3} ${-halfCarLength + pixelsPerMeter * 2.4} H ${halfCarWidth - pixelsPerMeter * 0.3} L ${halfCarWidth - pixelsPerMeter * 0.25} ${halfCarLength - pixelsPerMeter * 0.6} H ${-halfCarWidth + pixelsPerMeter * 0.25} Z`,
      }),
    );
    group.append(car);
    return { group, corners };
  };

  const formatRange = (rangeM) => `${formatMeters(rangeM)} m`;
  const referenceDistancesM = [...new Set((isLowBeamVisual
    ? [lowBeamRangeM / 4, lowBeamRangeM / 2, lowBeamRangeM]
    : [config.nearFieldRangeM / 2, config.debugRangeOneM, maxRangeM])
    .map((distanceM) => Math.min(beamRangeM, Math.max(1, distanceM))))];
  const sectorsForZone = (lamp, zone, distanceM) => beamModel.sectorsLitByZone(
    lamp, zone.index, distanceM, sectorCount, sectorBounds,
  );
  const sectorList = (indices) => indices.length
    ? indices.length === 1
      ? formatSector(indices[0])
      : `${formatSector(indices[0])}–${formatSector(indices.at(-1))}`
    : "none";
  const coverageText = (lamp, zone) => referenceDistancesM.map((distanceM) =>
    `${formatMeters(distanceM)} m: ${sectorList(sectorsForZone(lamp, zone, distanceM))}`,
  ).join(" · ");
  for (const { button, lamp, zone } of zoneControls.values()) {
    button.setAttribute(
      "title",
      `${lamp.side} matrix column ${zone.index} · sectors ${coverageText(lamp, zone)}`,
    );
  }
  for (const vehicle of vehicles) {
    const minimum = Math.ceil(Math.min(config.minVehicleRangeM, maxRangeM));
    const maximum = Math.max(minimum, Math.floor(maxRangeM));
    vehicle.forwardInput.min = String(minimum);
    vehicle.forwardInput.max = String(maximum);
    vehicle.forwardInput.step = "1";
    vehicle.forwardInput.value = String(Math.min(maximum, Math.max(minimum, vehicle.initialRangeM)));
    const boundedValue = Number(vehicle.forwardInput.value);
    vehicle.initialRangeM = boundedValue;
    setText(vehicle.minLabelId, formatRange(minimum));
    setText(vehicle.maxLabelId, formatRange(maximum));
    const offset = laneCenterLeftM(vehicle.laneFactor);
    setText(vehicle.laneOffsetId, `${offset > 0 ? "+" : offset < 0 ? "−" : ""}${formatMeters(Math.abs(offset))} m`);
  }

  const debugDistanceOne = config.debugRangeOneM;
  const debugDistanceTwo = config.debugRangeTwoM;
  setText("topbarGridSummary", `${sectorCount} sectors · 2 × 8×8 matrices`);
  setText("fieldSpanSummary", `${formatHalfAngle(isLowBeamVisual ? config.lowBeamHalfAngleDeg : config.beamHalfAngleDeg)} ${isLowBeamVisual ? "low" : "high"} beam`);
  setText("fieldRangeSummary", isLowBeamVisual
    ? `0–${formatMeters(beamRangeM)} m shine · ${formatMeters(lowViewRangeM)} m close-up`
    : `0–${formatMeters(beamRangeM)} m shine`);
  setText("rangeBandCaption", `${formatMeters(rangeBandSizeM)} m bands`);
  setText("beamRangeCaption", `${formatMeters(beamRangeM)} m range`);
  setText("beamFootprintCaption", isLowBeamVisual
    ? "Low-beam swivel footprints" : "High-beam column footprints");
  setText("vehicleSizeCaption", `${formatMeters(config.vehicleLengthM)} × ${formatMeters(config.vehicleWidthM)} m at grid scale`);
  setText("maskDimCaption", isLowBeamVisual
    ? "upper rows off in low-beam mode" : "distance-based top rows, affected columns");
  setText("gridSectorCount", String(sectorCount));
  setText("gridAngularSpan", `±${formatMeters(config.nearFieldHalfAngleDeg)}° / ±${formatMeters(config.farFieldHalfAngleDeg)}°`);
  setText("gridRangeSpec", `${formatMeters(maxRangeM)} m / ${formatMeters(rangeBandSizeM)} m`);
  setText("gridDimSpec", isLowBeamVisual
    ? "Rows 5–8 on · separate swivel angles" : "Distance selects 1–4 upper rows per column");
  setText("logicalSectorCount", String(sectorCount));
  setText("physicalZoneCount", "2×8×8");
  setText("lampZoneSpec", "8×8 each · 4 low + 4 high rows");
  setText("debugAngles", `NEAR ±${formatMeters(config.nearFieldHalfAngleDeg)}°  →  FAR ±${formatMeters(config.farFieldHalfAngleDeg)}° · smooth blend ${formatMeters(config.nearFieldRangeM)}–${formatMeters(config.nearFieldRangeM + config.blendWidthM)} m`);
  setText("debugRange", `${sectorCount} sectors · ${formatMeters(rangeBandSizeM)} m bands · max ${formatMeters(maxRangeM)} m · ${pixelsPerMeter.toFixed(2)} px/m`);
  const widthSummary = (distanceM, width) =>
    `${formatMeters(distanceM)} m cells: center ${width.centerWidth.toFixed(2)} m · range ${width.minWidth.toFixed(2)}–${width.maxWidth.toFixed(2)} m`;
  setText("debugWidthFirst", widthSummary(debugDistanceOne, effectiveCellWidthsAt(debugDistanceOne)));
  setText("debugWidthSecond", widthSummary(debugDistanceTwo, effectiveCellWidthsAt(debugDistanceTwo)));
  setText("debugMask", isLowBeamVisual
    ? `LOW ±${formatMeters(config.lowBeamHalfAngleDeg)}° / ${formatMeters(lowBeamRangeM)} m · servo yaw ±${formatMeters(config.maxSwivelDeg)}°`
    : `Top high-beam rows off by distance · vehicle half-angle + ${config.maskSectorMargin} sector margin`);
  setText("swivelRule", `The outside matrix turns three times farther than the inside one. At full wheel input, the outside aim is up to ${formatMeters(config.maxSwivelDeg)}° at 0 km/h and ${formatMeters(config.maxSwivelDeg * 0.25)}° at ${formatMeters(config.maxSpeedKmh)} km/h. The car stays in place.`);
  elements.debugOverlayBackground.setAttribute("width", config.canvasWidthPx * 0.455);
  elements.debugOverlayBackground.setAttribute("height", config.canvasWidthPx * 0.118);
  field.style.setProperty("--mask-occlusion", "0.82");

  if (isLowBeamVisual) {
    setText("beamTitle", "Short, wide low beam that follows steering.");
    setText("beamLede", "Rows 5–8 shine across a wider near field. Use the dashboard wheel slider and speed control to see the left and right matrices swivel by different amounts; rows 1–4 stay off.");
    setText("beamModeLabel", "LOW ONLY · SWIVEL ENABLED");
    setText("fieldTitle", "Two swiveling low-beam matrix headlights on a three-lane road");
    setText("controlEyebrow", "LOW-BEAM TEST SCENE");
    setText("controlTitle", "Driving dashboard and traffic");
    setText("controlDescription", `Adjust the steering wheel and speed to set separate left and right low-beam matrix angles. The outside matrix turns three times farther than the inside one, with a modest overall swivel. The car stays in place. The road close-up shows the first ${formatMeters(lowViewRangeM)} m; farther vehicles leave the view.`);
    setText("mappingTitle", "Low beam follows steering across a wide near field.");
    setText("mappingDescription", `Rows 1–4 are off. Rows 5–8 form a low beam that reaches ${formatMeters(lowBeamRangeM)} m with a ±${formatMeters(config.lowBeamHalfAngleDeg)}° span. The outside matrix turns three times farther than the inside matrix; on a left turn the left matrix moves less, and right turns mirror this. At full wheel input, the outside angle is up to ${formatMeters(config.maxSwivelDeg)}° at 0 km/h and ${formatMeters(config.maxSwivelDeg * 0.25)}° at ${formatMeters(config.maxSpeedKmh)} km/h. In high-beam mode both platforms return to center, while the low rows stay on.`);
  }

  const updateLowBeamYaw = (yawBySide) => {
    for (const lamp of lowLamps) {
      const yawDeg = yawBySide[lamp.side];
      lamp.aimDeg = lamp.centerAimDeg + yawDeg;
      for (const zone of lamp.zones) {
        zone.highDeg = zone.centerHighDeg + yawDeg;
        zone.lowDeg = zone.centerLowDeg + yawDeg;
      }
    }
    for (const wash of elements.lowBeamBase.children) {
      const lamp = lowLampBySide[wash.dataset.lamp];
      setAttribute(wash, "d", lampZonePath(lamp, {
        highDeg: lamp.zones[0].highDeg,
        lowDeg: lamp.zones.at(-1).lowDeg,
      }, lowBeamRangeM));
    }
    for (const side of ["left", "right"]) {
      elements[`${side}MatrixFace`].style.setProperty(
        "--swivel-angle", `${-yawBySide[side]}deg`,
      );
    }
  };

  const updateScene = () => {
    const wheelDeg = Number(elements.steeringAngle.value);
    const speedKmh = Number(elements.speedKmh.value);
    const swivel = beamModel.lowBeamSwivelForInputs(
      wheelDeg, speedKmh, config.maxSteeringWheelDeg,
      config.maxSpeedKmh, config.maxSwivelDeg,
    );
    const yawBySide = isLowBeamVisual
      ? {
        left: Math.round(swivel.leftYawDeg * 10) / 10,
        right: Math.round(swivel.rightYawDeg * 10) / 10,
      }
      : { left: 0, right: 0 };
    updateLowBeamYaw(yawBySide);
    const yawDeg = swivel.yawDeg;
    elements.steeringWheel.style.setProperty("--wheel-angle", `${-wheelDeg}deg`);
    elements.speedKmh.style.setProperty(
      "--speed-fill", `${(100 * speedKmh / config.maxSpeedKmh).toFixed(1)}%`,
    );
    setText("speedValue", String(speedKmh));
    setText("speedGainValue", `${Math.round(swivel.gain * 100)}% swivel response`);
    setText("steeringValue", wheelDeg === 0
      ? "0° · centered"
      : `${wheelDeg > 0 ? "+" : ""}${wheelDeg}° · ${wheelDeg > 0 ? "left" : "right"}`);
    const formatSwivel = (angle) => `${Math.abs(angle).toFixed(1)}°`;
    setText("swivelValue", yawDeg === 0
      ? "0° · centered"
      : `L ${formatSwivel(yawBySide.left)} · R ${formatSwivel(yawBySide.right)}`);
    const occupiedCells = new Set();
    const occupiedSectors = new Set();
    const centerSectors = new Set();
    const centerCells = new Set();
    const maskedCells = new Set();
    const maskedSectors = new Set();
    const maskedSectorDistancesM = Array(sectorCount).fill(Infinity);
    const renderedVehicles = [];
    const visibleSummaries = [];

    for (const vehicle of vehicles) {
      const forwardM = Number(vehicle.forwardInput.value);
      const leftM = laneCenterLeftM(vehicle.laneFactor);
      const isVisible = vehicle.visibleInput.checked;
      setText(vehicle.valueId, formatRange(forwardM));
      if (!isVisible) {
        setText(vehicle.readoutId, "Hidden · no sectors highlighted");
        continue;
      }

      const bearingDeg = angleForEgo(forwardM, leftM);
      const centerRangeM = Math.hypot(forwardM, leftM);
      const target = makeTargetVehicle(vehicle, forwardM, leftM);
      renderedVehicles.push(target.group);
      const cornerAngles = target.corners.map(([forward, lateral]) => angleForEgo(forward, lateral));
      const cornerRanges = target.corners.map(([forward, lateral]) => Math.hypot(forward, lateral));
      const minAngle = Math.min(...cornerAngles);
      const maxAngle = Math.max(...cornerAngles);
      const minRange = Math.min(...cornerRanges);
      const maxVehicleRange = Math.max(...cornerRanges);
      const inRange = centerRangeM <= maxRangeM + config.rangeBoundaryToleranceM;
      const centerSector = inRange ? sectorAt(bearingDeg, centerRangeM) : null;
      const coveredSectors = new Set();
      const coveredBands = [];

      if (inRange) {
        for (let band = 0; band < rangesM.length - 1; band += 1) {
          const bandInner = rangesM[band];
          const bandOuter = rangesM[band + 1];
          if (maxVehicleRange < bandInner || minRange > bandOuter) continue;
          const overlapStart = Math.max(bandInner, minRange);
          const overlapEnd = Math.min(bandOuter, maxVehicleRange);
          const distances = sampledValues(overlapStart, overlapEnd, config.pathSampleStepM);
          let bandCovered = false;
          for (let index = 0; index < sectorCount; index += 1) {
            const overlaps = distances.some((distanceM) => {
              const { highDeg, lowDeg } = sectorBounds(index, distanceM);
              return maxAngle >= lowDeg && minAngle <= highDeg;
            });
            if (!overlaps) continue;
            occupiedCells.add(`${band}:${index}`);
            coveredSectors.add(index);
            occupiedSectors.add(index);
            bandCovered = true;
          }
          if (bandCovered) coveredBands.push(band);
        }

        if (centerSector !== null) {
          const centerBand = bandIndexAt(centerRangeM);
          centerSectors.add(centerSector);
          centerCells.add(`${centerBand}:${centerSector}`);
        }

        const maskHalfAngleDeg = (Math.atan((config.vehicleWidthM / 2) / centerRangeM) * 180) / Math.PI;
        const maskLowDeg = bearingDeg - maskHalfAngleDeg;
        const maskHighDeg = bearingDeg + maskHalfAngleDeg;
        const overlapping = [];
        for (let index = 0; index < sectorCount; index += 1) {
          const { highDeg, lowDeg } = sectorBounds(index, centerRangeM);
          if (maskHighDeg >= lowDeg && maskLowDeg <= highDeg) overlapping.push(index);
        }
        if (highBeamOn && overlapping.length) {
          const first = Math.max(0, overlapping[0] - config.maskSectorMargin);
          const last = Math.min(sectorCount - 1, overlapping.at(-1) + config.maskSectorMargin);
          for (let index = first; index <= last; index += 1) {
            maskedSectors.add(index);
            maskedSectorDistancesM[index] = Math.min(
              maskedSectorDistancesM[index], centerRangeM,
            );
            for (let band = 0; band < rangesM.length - 1; band += 1) {
              if (rangesM[band + 1] + config.rangeBoundaryToleranceM >= centerRangeM) {
                maskedCells.add(`${band}:${index}`);
              }
            }
          }
        }

        visibleSummaries.push(`${vehicle.lane} lane vehicle at ${formatRange(forwardM)}`);
      }

      const sortedCoveredSectors = [...coveredSectors].sort((a, b) => a - b);
      const sectorSummary = sortedCoveredSectors.length === 1
        ? `sector ${formatSector(sortedCoveredSectors[0])}`
        : sortedCoveredSectors.length > 1
          ? `sectors ${formatSector(sortedCoveredSectors[0])}–${formatSector(sortedCoveredSectors.at(-1))}`
          : centerRangeM > maxRangeM
            ? `outside ${formatMeters(maxRangeM)} m range`
            : `outside ±${formatMeters(fieldHalfAngleAt(centerRangeM))}° field`;
      const bandSummary = coveredBands.length
        ? ` · bands ${formatMeters(rangesM[coveredBands[0]])}–${formatMeters(rangesM[coveredBands.at(-1) + 1])} m`
        : "";
      setText(
        vehicle.readoutId,
        `Bearing ${bearingDeg > 0 ? "+" : ""}${bearingDeg.toFixed(1)}° · ${sectorSummary}${bandSummary}`,
      );
    }

    vehicleLayer.replaceChildren(...renderedVehicles);
    const lampMasks = Object.fromEntries(lamps.map((lamp) => [
      lamp.side,
      beamModel.maskedRowsByColumnForSectors(lamp, maskedSectorDistancesM, sectorBounds),
    ]));
    const activeZone = selectedZone ? zoneControls.get(selectedZone) : null;
    const focusedCells = new Set();
    if (activeZone) {
      for (let band = 0; band < rangesM.length - 1; band += 1) {
        if (rangesM[band] >= beamRangeM) continue;
        const distanceM = (rangesM[band] + rangesM[band + 1]) / 2;
        for (const sector of sectorsForZone(activeZone.lamp, activeZone.zone, distanceM)) {
          focusedCells.add(`${band}:${sector}`);
        }
      }
    }
    const focusedLabels = activeZone && highBeamOn
      ? new Set(sectorsForZone(activeZone.lamp, activeZone.zone, sectorLabelDistance))
      : new Set();
    field.classList.toggle("inspecting-zone", Boolean(activeZone));
    field.style.setProperty("--selected-zone-color", activeZone?.color || "transparent");
    const outline = activeZone && makeSvg("path", {
      class: "selected-zone-outline",
      d: lampZonePath(activeZone.lamp, activeZone.zone),
    });
    elements.zoneSelectionOutline.replaceChildren(...(outline ? [outline] : []));
    setText(
      "zoneFocusReadout",
      activeZone
        ? `${activeZone.lamp.side.toUpperCase()} MATRIX · column ${activeZone.zone.index} covers sectors ${coverageText(activeZone.lamp, activeZone.zone)}. Select again to show all columns.`
        : `Select a matrix column to inspect its road sectors at ${referenceDistancesM.map(formatMeters).join(", ")} m.`,
    );
    const roadMask = [...maskedSectors].reduce(
      (bits, index) => bits | (1n << BigInt(index)), 0n,
    );
    setText("roadMaskReadout", highBeamOn
      ? `Logical road mask 0x${roadMask.toString(16).toUpperCase().padStart(Math.ceil(sectorCount / 4), "0")}`
      : "ADB mask inactive · low beam only");
    for (const marker of elements.lampEmitters.children) {
      const lamp = lampBySide[marker.dataset.lamp];
      const rayEnd = lampPoint(lamp, Math.min(beamRangeM, 12), lamp.aimDeg);
      setAttribute(marker.children[0], "x2", rayEnd.x);
      setAttribute(marker.children[0], "y2", rayEnd.y);
    }
    for (const zone of elements.headlightBeams.children) {
      const key = zoneKey(zone.dataset.lamp, Number(zone.dataset.zone));
      const { lamp, zone: column } = zoneControls.get(key);
      setAttribute(zone, "d", lampZonePath(lamp, column, beamRangeM));
      const rowsMasked = highBeamOn
        ? lampMasks[zone.dataset.lamp].get(column.index) || 0
        : 0;
      zone.style.setProperty("--zone-opacity", String(.82 * (1 - rowsMasked / 4)));
      zone.classList.toggle(
        "is-dimmed",
        rowsMasked > 0,
      );
      zone.classList.toggle("is-selected", selectedZone === key);
    }
    for (const { pixel, lamp, row, column } of matrixPixels) {
      const pixelState = beamModel.matrixPixelState(
        row, column, highBeamOn, lampMasks[lamp.side],
      );
      pixel.classList.toggle("is-lit", pixelState.lit);
      pixel.classList.toggle("is-masked", pixelState.masked);
      pixel.classList.toggle("is-selected", selectedZone === zoneKey(lamp.side, column));
    }
    for (const [key, { button, level, lamp, zone }] of zoneControls) {
      const rowsMasked = lampMasks[lamp.side].get(zone.index) || 0;
      const isMasked = rowsMasked > 0;
      const isSelected = selectedZone === key;
      button.style.setProperty("--zone-output", String(1 - rowsMasked / 4));
      button.setAttribute(
        "title",
        `${lamp.side} matrix column ${zone.index} · sectors ${coverageText(lamp, zone)}`,
      );
      button.classList.toggle("is-dimmed", isMasked && highBeamOn);
      button.classList.toggle("is-off", false);
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
      level.textContent = highBeamOn ? (isMasked ? `${rowsMasked}/4` : "ON") : "LOW";
    }
    const maskSummary = lamps.map((lamp) => {
      const columns = [...lampMasks[lamp.side].entries()].sort(([a], [b]) => a - b);
      return `${lamp.side === "left" ? "L" : "R"}: ${columns.length
        ? columns.map(([index, rows]) => `C${index} ${rows}/4`).join(", ")
        : "none"}`;
    }).join(" · ");
    setText("lampMaskReadout", highBeamOn
      ? `High-beam top rows switched off — ${maskSummary}`
      : `Low-beam swivel — L: ${yawDeg > 0 ? "+" : ""}${yawDeg}° · R: ${yawDeg > 0 ? "+" : ""}${yawDeg}°`);
    for (const lamp of lamps) {
      const maskedHighPixels = highBeamOn
        ? [...lampMasks[lamp.side].values()].reduce((total, rows) => total + rows, 0)
        : 0;
      const activePixelCount = beamModel.MATRIX_SIZE * beamModel.MATRIX_SIZE
        - (highBeamOn
          ? maskedHighPixels
          : beamModel.MATRIX_SIZE * beamModel.HIGH_BEAM_ROW_COUNT);
      setText(
        `${lamp.side}MatrixState`,
        `${highBeamOn ? "LOW + HIGH" : "LOW ONLY"} · ${activePixelCount}/64 on`,
      );
    }
    for (const cell of cellLayer.children) {
      const index = Number(cell.dataset.sector);
      const band = Number(cell.dataset.band);
      const key = `${band}:${index}`;
      cell.classList.toggle("is-covered", occupiedCells.has(key));
      cell.classList.toggle("is-center", centerCells.has(key));
      cell.classList.toggle("is-masked", maskedCells.has(key));
      cell.classList.toggle("is-zone-covered", focusedCells.has(key));
    }
    for (const label of sectorLabelLayer.children) {
      const index = Number(label.dataset.sectorLabel);
      label.classList.toggle("is-covered", occupiedSectors.has(index));
      label.classList.toggle("is-center", centerSectors.has(index));
      label.classList.toggle("is-masked", maskedSectors.has(index));
      label.classList.toggle("is-zone-covered", focusedLabels.has(index));
    }

    const visibleCount = vehicles.filter(({ visibleInput }) => visibleInput.checked).length;
    const sceneDescription = visibleSummaries.length
      ? `${visibleSummaries.join(", ")}.`
      : "All test vehicles are hidden.";
    const describeLampTurn = (angle) => angle === 0
      ? "stays centered"
      : `turns ${angle > 0 ? "left" : "right"} by ${formatMeters(Math.abs(angle))} degrees`;
    setText(
      "fieldDescription",
      highBeamOn
        ? `A three-lane highway with a ${sectorCount}-sector logical grid to ${formatMeters(maxRangeM)} meters. Both matrix platforms are centered. Rows 5 through 8 provide a short, wide low beam to ${formatMeters(lowBeamRangeM)} meters. Rows 1 through 4 add a high beam to ${formatMeters(maxRangeM)} meters with a ±${formatMeters(config.beamHalfAngleDeg)} degree half-angle. The high-beam ADB mask switches off more top rows as a vehicle gets closer. ${sceneDescription} ${visibleCount} test ${visibleCount === 1 ? "vehicle is" : "vehicles are"} visible. ${maskSummary}.${activeZone ? ` Selected ${activeZone.lamp.side} matrix column ${activeZone.zone.index} covers ${coverageText(activeZone.lamp, activeZone.zone)}.` : ""}`
        : `A three-lane highway with a ${sectorCount}-sector logical grid to ${formatMeters(maxRangeM)} meters, zoomed to the first ${formatMeters(lowViewRangeM)} meters. Vehicles farther away leave the visible frame. Rows 1 through 4 are off. Rows 5 through 8 provide a low beam to ${formatMeters(lowBeamRangeM)} meters with a wider ±${formatMeters(config.lowBeamHalfAngleDeg)} degree half-angle. At ${speedKmh} kilometers per hour and ${wheelDeg} degrees of steering wheel angle, the left matrix ${describeLampTurn(yawBySide.left)} and the right matrix ${describeLampTurn(yawBySide.right)}; the outside matrix turns farther and both angles decrease with speed. The car stays in place. ADB masking is inactive. ${sceneDescription} ${visibleCount} test ${visibleCount === 1 ? "vehicle is" : "vehicles are"} visible.${activeZone ? ` Selected ${activeZone.lamp.side} low-beam column ${activeZone.zone.index} covers ${coverageText(activeZone.lamp, activeZone.zone)}.` : ""}`,
    );
  };

  for (const { forwardInput, visibleInput } of vehicles) {
    forwardInput.addEventListener("input", updateScene);
    visibleInput.addEventListener("change", updateScene);
  }

  elements.steeringAngle.addEventListener("input", updateScene);
  elements.speedKmh.addEventListener("input", updateScene);

  updateScene();
})();
