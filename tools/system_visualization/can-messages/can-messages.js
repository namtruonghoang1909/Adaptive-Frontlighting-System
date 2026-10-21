(() => {
  "use strict";

  const row = (name, byte, bits, meaning, sample) => ({ name, byte, bits, meaning, sample });
  const faultBits = [
    ["SteeringStale", "No fresh accepted 0x200 steering message arrived before timeout."],
    ["SpeedStale", "No fresh accepted 0x100 speed message arrived before timeout."],
    ["ObjectStale", "No fresh accepted 0x300 vehicle grid arrived before timeout."],
    ["DashboardStale", "No fresh accepted 0x400 dashboard command arrived before timeout."],
    ["ServoControlLost", "The ECU cannot command the servo control path."],
    ["ServoMismatch", "Servo feedback differs from the requested angle beyond tolerance."],
    ["BeamControlLost", "The ECU cannot apply the requested MAX7219 matrix pattern."],
    ["CanDecodeFault", "At least one received CAN frame failed validation."],
  ];

  const layouts = {
    "0x500": [
      row("AliveCounter", "0", "0–3", "Rolling ECU counter from 0 to 15.", "2"),
      row("RequiredInputsValid", "0", "4", "1 means the inputs required by the active mode are fresh and accepted.", "1"),
      row("FaultPresent", "0", "5", "1 means one or more fault bits in byte 2 are set.", "0"),
      row("SafeFallback", "0", "6", "1 means the ECU forced conservative fallback lighting.", "0"),
      row("Reserved", "0", "7", "Transmit zero.", "0"),
      row("ExecutedMode", "1", "0–2", "0 Off; 1 Safe Default; 2 Low/no swivel; 3 Low/swivel; 4 High/no dimming; 5 High/dimming.", "5 — High/dimming"),
      row("Reserved", "1", "3", "Transmit zero.", "0"),
      row("HealthState", "1", "4–7", "0 OK; 1 Degraded; 2 Faulted; 3 Safe fallback; 4–15 reserved.", "0 — OK"),
      ...faultBits.map(([name, meaning], bit) => row(name, "2", String(bit), meaning, "0")),
      row("LeftServoFeedbackDeg", "3", "0–7", "Signed angle feedback; 0.5° per count.", "0° (raw 0)"),
      row("RightServoFeedbackDeg", "4", "0–7", "Signed angle feedback; 0.5° per count.", "0° (raw 0)"),
      row("AppliedDimSectorMask", "5–6", "Byte 5 bits 0–7; byte 6 bits 0–1", "Little-endian mask. Bits 0–9 identify sectors with high-beam pixels switched off; byte 6 bits 2–7 are reserved.", "0x019C — sectors 02, 03, 04, 07, 08"),
      row("Reserved", "6", "2–7", "Unused upper bits of AppliedDimSectorMask; transmit zero.", "0"),
      row("Checksum", "7", "0–7", "XOR of bytes 0–6.", "0x8A"),
    ],
    "0x200": [
      row("AliveCounter", "0", "0–3", "Increment each transmitted frame, even for invalid or repeated source data; wrap 15 to 0.", "7"),
      row("SteeringValid", "0", "4", "1 means steering and its MetaDrive limit are usable and no older than 250 ms; runner input faults clear it.", "1"),
      row("SteeringSaturated", "0", "5", "1 means the angle was clamped to fit the CAN field; SteeringValid must also be 0, so the ECU ignores the value.", "0"),
      row("Reserved", "0", "6–7", "Transmit zero.", "0"),
      row("SteeringAngleDeg", "1–2", "Byte 1 bits 0–7 (low); byte 2 bits 0–7 (high)", "Signed int16 little-endian; 0.1° per count. Sign follows MetaDrive; the bridge does not convert it.", "+12.3° (raw 0x007B)"),
      row("Reserved", "3", "0–7", "Transmit zero; steering rate is not used by the agreed swivel input.", "0"),
      row("Reserved", "4–6", "0–7 in each byte", "Transmit zero.", "0"),
      row("Reserved", "7", "0–7", "Transmit zero; this frame relies on Classical CAN CRC and has no application checksum.", "0"),
    ],
    "0x100": [
      row("AliveCounter", "0", "0–3", "Increment each transmitted frame, even for invalid or repeated source data; wrap 15 to 0.", "8"),
      row("SpeedValid", "0", "4", "1 means the signed speed sample is usable and no older than 250 ms; runner input faults clear it.", "1"),
      row("SpeedSaturated", "0", "5", "1 means speed was clamped to fit the CAN field; SpeedValid must also be 0, so the ECU ignores the value.", "0"),
      row("Reserved", "0", "6", "Transmit zero; reverse is represented by negative signed speed.", "0"),
      row("Reserved", "0", "7", "Transmit zero.", "0"),
      row("LongitudinalSpeedMps", "1–2", "Byte 1 bits 0–7 (low); byte 2 bits 0–7 (high)", "Signed int16 little-endian; 0.01 m/s per count. Positive is forward; negative is reverse.", "+10.00 m/s (raw 0x03E8; bytes E8 03)"),
      row("Reserved", "3", "0–7", "Transmit zero; acceleration is not required by the agreed swivel behavior.", "0"),
      row("Reserved", "4–6", "0–7 in each byte", "Transmit zero.", "0"),
      row("Reserved", "7", "0–7", "Transmit zero; this frame relies on Classical CAN CRC and has no application checksum.", "0"),
    ],
    "0x300": [],
    "0x400": [
      row("AliveCounter", "0", "0–3", "Rolling bridge CAN-interface counter from 0 to 15.", "4"),
      row("CommandValid", "0", "4", "1 means the dashboard command is fresh and usable.", "1"),
      row("ClearFaultRequest", "0", "5", "Momentary request to clear faults that are safe to clear.", "0"),
      row("Reserved", "0", "6–7", "Transmit zero.", "0"),
      row("RequestedHeadlightPower", "1", "0", "0 Off; 1 On.", "1 — On"),
      row("RequestedHeadlightMode", "1", "1–3", "0 Low/no swivel; 1 Low/swivel; 2 High/no dimming; 3 High/dimming; 4–7 reserved.", "3 — High/dimming"),
      row("Reserved", "1", "4–7", "Transmit zero.", "0"),
      row("Checksum", "2", "0–7", "XOR of bytes 0–1.", "0x13"),
    ],
  };

  const maskMeanings = [
    "Farthest mask bit; 75–100 m band.",
    "Second-farthest mask bit; 50–75 m band.",
    "Second-nearest mask bit; 25–50 m band.",
    "Nearest mask bit; 0–25 m band.",
  ];
  const samplePayload = [0x00, 0x01, 0x00, 0x7C, 0x00, 0xC0, 0x00, 0x00];
  const payloadBit = (position) => (samplePayload[Math.floor(position / 8)] >> (position % 8)) & 1;
  const byteBitLocation = (position) => ({ byte: String(Math.floor(position / 8)), bits: String(position % 8) });

  layouts["0x300"].push(
    row("Reserved", "0", "0–7", "Transmit zero; grid freshness and validity are reported by GridValid.", "0"),
    row("GridValid", "1", "0", "1 means the complete grid is fresh and usable. If 0, the ECU ignores sector data and enters fallback.", "1"),
    row("PerceptionDegraded", "1", "1", "1 means the object scan or required vehicle geometry is incomplete or unusable; GridValid must then be 0.", "0"),
    row("ObjectListOverflow", "1", "2", "1 means the runner dropped candidates at its object-list limit.", "0"),
  );
  for (let sector = 0; sector < 10; sector += 1) {
    const start = 11 + 5 * sector;
    const occupied = byteBitLocation(start);
    const sectorName = String(sector).padStart(2, "0");
    layouts["0x300"].push(row(
      `Sector ${sectorName} Occupied`, occupied.byte, occupied.bits,
      `1 means one or more relevant vehicles overlap horizontal sector ${sectorName}.`,
      String(payloadBit(start)),
    ));
    for (let maskBit = 0; maskBit < 4; maskBit += 1) {
      const position = start + 1 + maskBit;
      const location = byteBitLocation(position);
      layouts["0x300"].push(row(
        `Sector ${sectorName} Mask M${maskBit}`, location.byte, location.bits,
        `Cumulative distance mask bit ${maskBit}. ${maskMeanings[maskBit]}`,
        String(payloadBit(position)),
      ));
    }
  }
  layouts["0x300"].push(row("Reserved", "7", "5–7", "Transmit zero; the receiver rejects nonzero values.", "0"));

  const renderTable = (container, rows, messageId, doc = document) => {
    const table = doc.createElement("table");
    table.className = "signal-list";
    table.setAttribute("aria-label", `${messageId} signal names, positions, meanings, and example values`);
    const thead = doc.createElement("thead");
    const heading = doc.createElement("tr");
    for (const label of ["Signal / bit name", "Byte", "Bit(s)", "Meaning", "Sample value"]) {
      const th = doc.createElement("th");
      th.scope = "col";
      th.textContent = label;
      heading.append(th);
    }
    thead.append(heading);
    const tbody = doc.createElement("tbody");
    rows.forEach((signal, index) => {
      const tr = doc.createElement("tr");
      tr.setAttribute("id", signalRowId(messageId, index));
      for (const value of [signal.name, signal.byte, signal.bits, signal.meaning, signal.sample]) {
        const td = doc.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      tbody.append(tr);
    });
    table.append(thead, tbody);
    container.replaceChildren(table);
  };

  const signalRowId = (messageId, index) => `signal-${messageId.slice(2)}-${index}`;

  const expandRange = (text) => {
    const match = String(text).match(/(\d+)\s*(?:–|-|\.\.)\s*(\d+)|(\d+)/);
    if (!match) return [];
    const start = Number(match[1] ?? match[3]);
    const end = Number(match[2] ?? match[3]);
    return Array.from({ length: Math.abs(end - start) + 1 }, (_, offset) => start + Math.sign(end - start) * offset);
  };

  const locationsForSignal = (signal) => {
    const explicit = [...String(signal.bits).matchAll(/byte\s+(\d+)\s+bits?\s+(\d+)(?:\s*(?:–|-|\.\.)\s*(\d+))?/gi)];
    if (explicit.length) {
      return explicit.flatMap((match) => {
        const byte = Number(match[1]);
        const start = Number(match[2]);
        const end = Number(match[3] ?? match[2]);
        return expandRange(`${start}–${end}`).map((bit) => ({ byte, bit }));
      });
    }
    const bytes = expandRange(signal.byte);
    const bits = expandRange(signal.bits);
    return bytes.flatMap((byte) => bits.map((bit) => ({ byte, bit })));
  };

  const formatBits = (bits) => {
    const ordered = [...new Set(bits)].sort((a, b) => a - b);
    const ranges = [];
    for (let index = 0; index < ordered.length;) {
      let end = index;
      while (end + 1 < ordered.length && ordered[end + 1] === ordered[end] + 1) end += 1;
      ranges.push(index === end ? String(ordered[index]) : `${ordered[index]}–${ordered[end]}`);
      index = end + 1;
    }
    return ranges.join(", ");
  };

  const renderByteMap = (container, rows, messageId, dlc, payloadHex, doc = document) => {
    const payload = String(payloadHex).trim().split(/\s+/).map((byte) => Number.parseInt(byte, 16));
    const byteGroups = Array.from({ length: dlc }, () => []);
    rows.forEach((signal, index) => {
      const byByte = new Map();
      for (const location of locationsForSignal(signal)) {
        if (location.byte < 0 || location.byte >= dlc || location.bit < 0 || location.bit > 7) continue;
        if (!byByte.has(location.byte)) byByte.set(location.byte, []);
        byByte.get(location.byte).push(location.bit);
      }
      for (const [byte, bits] of byByte) byteGroups[byte].push({ signal, index, bits });
    });

    const map = doc.createElement("div");
    map.className = "byte-map-grid";
    map.setAttribute("style", `--byte-count:${dlc};--byte-map-width:${dlc * 132 + (dlc - 1) * 8}px`);
    map.setAttribute("aria-label", `${messageId} payload divided into ${dlc} bytes`);

    byteGroups.forEach((groups, byte) => {
      const segment = doc.createElement("section");
      segment.className = "byte-segment";
      segment.setAttribute("aria-label", `Byte ${byte}`);
      const heading = doc.createElement("h4");
      heading.textContent = `Byte ${byte}`;

      const bitRow = doc.createElement("div");
      bitRow.className = "byte-bit-row";
      const owners = Array(8).fill(null);
      for (const group of groups) for (const bit of group.bits) owners[bit] = group;
      for (let bit = 7; bit >= 0; bit -= 1) {
        const owner = owners[bit];
        const value = ((payload[byte] ?? 0) >> bit) & 1;
        const cell = doc.createElement("div");
        cell.className = `byte-bit${owner?.signal.name === "Reserved" ? " byte-bit-reserved" : value ? " byte-bit-set" : ""}`;
        cell.setAttribute("aria-label", `Byte ${byte}, bit ${bit}, ${owner?.signal.name ?? "unmapped"}, sample ${value}`);
        const bitIndex = doc.createElement("span");
        bitIndex.className = "byte-bit-index";
        bitIndex.textContent = String(bit);
        const sample = doc.createElement("strong");
        sample.textContent = String(value);
        cell.append(bitIndex, sample);
        bitRow.append(cell);
      }

      const callouts = doc.createElement("div");
      callouts.className = "byte-callouts";
      for (const group of groups) {
        const callout = doc.createElement("div");
        callout.className = `byte-callout${group.signal.name === "Reserved" ? " byte-callout-reserved" : ""}`;
        const arrow = doc.createElement("span");
        arrow.className = "byte-callout-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↓";
        const link = doc.createElement("a");
        link.href = `#${signalRowId(messageId, group.index)}`;
        link.title = `${group.signal.name}, byte ${byte}, bits ${formatBits(group.bits)}`;
        link.textContent = group.signal.name;
        const range = doc.createElement("small");
        range.textContent = `bits ${formatBits(group.bits)}`;
        link.append(range);
        callout.append(arrow, link);
        callouts.append(callout);
      }
      segment.append(heading, bitRow, callouts);
      map.append(segment);
    });
    container.replaceChildren(map);
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { layouts, renderByteMap, renderTable };
  }
  if (typeof document !== "undefined") {
    for (const container of document.querySelectorAll("[data-message-table]")) {
      const messageId = container.dataset.messageTable;
      if (layouts[messageId]) renderTable(container, layouts[messageId], messageId);
    }
    for (const container of document.querySelectorAll("[data-message-map]")) {
      const messageId = container.dataset.messageMap;
      const card = document.getElementById(`message-${messageId.slice(2)}`);
      const payloadHex = card?.querySelector(".sample-payload code")?.textContent;
      if (layouts[messageId] && payloadHex) {
        renderByteMap(container, layouts[messageId], messageId, Number(container.dataset.dlc), payloadHex);
      }
    }
  }
})();
