const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { layouts, renderByteMap, renderTable } = require("../can-messages/can-messages.js");

class TestElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
}

const testDocument = { createElement: (tagName) => new TestElement(tagName) };
const descendants = (element) => element.children.flatMap((child) => [child, ...descendants(child)]);

test("all five messages list each signal with byte, bit, meaning, and sample value", () => {
  assert.deepEqual(Object.keys(layouts).sort(), ["0x100", "0x200", "0x300", "0x400", "0x500"]);
  for (const [id, signals] of Object.entries(layouts)) {
    assert.ok(signals.length > 0, `${id} has signal rows`);
    for (const signal of signals) {
      assert.ok(signal.name && signal.byte && signal.bits && signal.meaning && signal.sample,
        `${id} ${signal.name} has every table value`);
    }
  }
});

test("0x300 sector bits use the agreed positions and decode the example payload", () => {
  const signals = new Map(layouts["0x300"].map((signal) => [signal.name, signal]));
  assert.equal(signals.has("GridSampleCounter"), false);
  assert.deepEqual(layouts["0x300"].find((signal) => signal.name === "Reserved" && signal.byte === "0"), {
    name: "Reserved", byte: "0", bits: "0–7",
    meaning: "Transmit zero; grid freshness and validity are reported by GridValid.", sample: "0",
  });
  assert.equal(signals.get("GridValid").byte, "1");
  assert.equal(signals.get("GridValid").bits, "0");
  assert.equal(signals.get("Sector 00 Occupied").byte, "1");
  assert.equal(signals.get("Sector 00 Occupied").bits, "3");
  for (let sector = 0; sector < 10; sector += 1) {
    const start = 11 + 5 * sector;
    const prefix = `Sector ${String(sector).padStart(2, "0")}`;
    for (let recordBit = 0; recordBit < 5; recordBit += 1) {
      const position = start + recordBit;
      const name = recordBit === 0 ? `${prefix} Occupied` : `${prefix} Mask M${recordBit - 1}`;
      assert.equal(signals.get(name).byte, String(Math.floor(position / 8)));
      assert.equal(signals.get(name).bits, String(position % 8));
    }
  }
  assert.equal(signals.get("Sector 03 Occupied").sample, "1");
  assert.equal(signals.get("Sector 03 Mask M3").sample, "1");
  assert.equal(signals.get("Sector 07 Occupied").bits, "6");
  assert.equal(signals.get("Sector 07 Mask M0").bits, "7");
  assert.equal(signals.get("Sector 07 Mask M0").sample, "1");
  assert.equal(signals.get("Sector 07 Mask M1").sample, "0");
  assert.equal(signals.get("Reserved").byte, "7");
});

test("rendered signal table uses the requested five columns and lists rows in order", () => {
  const container = new TestElement("div");
  renderTable(container, layouts["0x300"], "0x300", testDocument);
  const [table] = container.children;
  assert.match(table.attributes["aria-label"], /signal names, positions, meanings, and example values/);
  const [thead, tbody] = table.children;
  assert.deepEqual(thead.children[0].children.map((cell) => cell.textContent), [
    "Signal / bit name", "Byte", "Bit(s)", "Meaning", "Sample value",
  ]);
  const occupiedRow = tbody.children.find((tr) => tr.children[0].textContent === "Sector 03 Occupied");
  assert.deepEqual(occupiedRow.children.map((cell) => cell.textContent), [
    "Sector 03 Occupied", "3", "2",
    "1 means one or more relevant vehicles overlap horizontal sector 03.", "1",
  ]);
});

test("byte map renders one segment per transmitted byte with links to signal rows", () => {
  const container = new TestElement("div");
  renderByteMap(container, layouts["0x200"], "0x200", 8, "17 7B 00 00 00 00 00 00", testDocument);
  const [map] = container.children;
  assert.equal(map.children.length, 8);
  assert.equal(map.children[0].attributes["aria-label"], "Byte 0");
  const bits = map.children[0].children[1].children;
  assert.deepEqual(bits.map((bit) => [bit.children[0].textContent, bit.children[1].textContent]), [
    ["7", "0"], ["6", "0"], ["5", "0"], ["4", "1"],
    ["3", "0"], ["2", "1"], ["1", "1"], ["0", "1"],
  ]);
  const callouts = map.children[0].children[2].children;
  const alive = callouts.find((callout) => callout.children[1].textContent === "AliveCounter");
  assert.ok(alive);
  assert.equal(alive.children[1].href, "#signal-200-0");
  assert.equal(alive.children[1].children[0].textContent, "bits 0–3");
});

test("byte map follows the message DLC and splits multi-byte signal locations", () => {
  const steering = new TestElement("div");
  renderByteMap(steering, layouts["0x200"], "0x200", 8, "17 7B 00 00 00 00 00 00", testDocument);
  const steeringMap = steering.children[0];
  for (const byte of [1, 2]) {
    const callout = steeringMap.children[byte].children[2].children
      .find((item) => item.children[1].textContent === "SteeringAngleDeg");
    assert.ok(callout, `SteeringAngleDeg maps into byte ${byte}`);
    assert.equal(callout.children[1].href, "#signal-200-4");
    assert.equal(callout.children[1].children[0].textContent, "bits 0–7");
  }

  const status = new TestElement("div");
  renderByteMap(status, layouts["0x400"], "0x400", 3, "14 07 13", testDocument);
  assert.equal(status.children[0].children.length, 3);
  assert.equal(status.children[0].children[2].children[2].children[0].children[1].textContent, "Checksum");
});

test("all message byte maps cover every bit and link to existing signal rows", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../can-messages/index.html"), "utf8");
  for (const messageId of Object.keys(layouts)) {
    const article = html.match(new RegExp(`<article id="message-${messageId.slice(2)}"[\\s\\S]*?<\\/article>`))?.[0];
    assert.ok(article, `${messageId} card exists`);
    const dlc = Number(article.match(/data-dlc="(\d+)"/)?.[1]);
    const payload = article.match(/class="sample-payload"[\s\S]*?<code>([^<]+)<\/code>/)?.[1];
    assert.ok(payload, `${messageId} has an example payload`);
    const mapContainer = new TestElement("div");
    const tableContainer = new TestElement("div");
    renderByteMap(mapContainer, layouts[messageId], messageId, dlc, payload, testDocument);
    renderTable(tableContainer, layouts[messageId], messageId, testDocument);
    const map = mapContainer.children[0];
    const tableIds = new Set(descendants(tableContainer).map((node) => node.attributes.id).filter(Boolean));
    assert.equal(map.children.length, dlc, `${messageId} has one segment per byte`);
    for (const bit of descendants(map).filter((node) => node.className?.split(" ").includes("byte-bit"))) {
      assert.doesNotMatch(bit.attributes["aria-label"], /unmapped/,
        `${messageId} ${bit.attributes["aria-label"]} has a signal owner`);
    }
    const links = descendants(map).filter((node) => node.href?.startsWith("#signal-"));
    assert.ok(links.length > 0, `${messageId} has signal callouts`);
    for (const link of links) assert.ok(tableIds.has(link.href.slice(1)), `${messageId} callout targets a row`);
  }
});

test("the page shows each message with its sample payload and linked byte map", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../can-messages/index.html"), "utf8");
  const script = fs.readFileSync(path.resolve(__dirname, "../can-messages/can-messages.js"), "utf8");
  for (const id of Object.keys(layouts)) {
    assert.match(html, new RegExp(`data-message-table="${id}"`));
    assert.match(html, new RegExp(`data-message-map="${id}"`));
    assert.match(html, new RegExp(`id="message-${id.slice(2)}"`));
  }
  assert.match(script, /Signal \/ bit name/);
  assert.match(script, /Byte \$\{byte\}/);
  assert.match(html, /Arrows link to the matching signal row/);
  assert.match(html, /Example payload/);
});

test("runner-derived CAN messages show their transmit periods and ECU timeouts", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../can-messages/index.html"), "utf8");
  for (const [id, period, timeout] of [
    ["100", "20 ms TX", "100 ms ECU timeout"],
    ["200", "20 ms TX", "100 ms ECU timeout"],
    ["300", "100 ms TX", "250 ms ECU timeout"],
  ]) {
    const card = html.match(new RegExp(`<article id="message-${id}"[\\s\\S]*?<\\/article>`))?.[0];
    assert.ok(card, `0x${id} card exists`);
    assert.ok(card.includes(period), `0x${id} shows ${period}`);
    assert.ok(card.includes(timeout), `0x${id} shows ${timeout}`);
  }
  const status = html.match(/<article id="message-500"[\s\S]*?<\/article>/)?.[0];
  assert.ok(status?.includes("50 ms suggested ECU period"));
});

test("steering and speed validity rows explain immediate invalidation on runner faults", () => {
  const steering = layouts["0x200"].find((signal) => signal.name === "SteeringValid");
  const speed = layouts["0x100"].find((signal) => signal.name === "SpeedValid");
  assert.match(steering.meaning, /runner input faults clear it/);
  assert.match(speed.meaning, /runner input faults clear it/);
});

test("0x100 and 0x200 reserve byte 7 and rely on the CAN CRC", () => {
  const specifications = {
    "0x100": "docs/can/messages/0x100_Vehicle_Speed.md",
    "0x200": "docs/can/messages/0x200_Vehicle_Steering.md",
  };
  const root = path.resolve(__dirname, "../../..");
  for (const [id, relativePath] of Object.entries(specifications)) {
    const signals = layouts[id];
    assert.equal(signals.some((signal) => signal.name === "Checksum"), false);
    const byte7 = signals.find((signal) => signal.name === "Reserved" && signal.byte === "7");
    assert.ok(byte7, `${id} byte 7 is reserved`);
    assert.match(byte7.meaning, /Classical CAN CRC and has no application checksum/);
    const specification = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.match(specification, /\| 7 \| 0\.\.7 \| `Reserved`/);
    assert.doesNotMatch(specification, /\| 7 \| 0\.\.7 \| `Checksum`/);
  }
  const html = fs.readFileSync(path.resolve(__dirname, "../can-messages/index.html"), "utf8");
  assert.match(html, /17 7B 00 00 00 00 00 00/);
  assert.match(html, /18 E8 03 00 00 00 00 00/);
});

test("the CAN page opts into a light surface with orange navigation accents", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../can-messages/index.html"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../can-messages/can-messages.css"), "utf8");
  assert.match(html, /<meta name="color-scheme" content="light">/);
  assert.match(css, /background: #fff8f0/);
  assert.match(css, /background: #dc6d1c/);
});
