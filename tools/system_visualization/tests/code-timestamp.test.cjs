const assert = require("node:assert/strict");
const test = require("node:test");
const { newestCodeModification, formatLocalTimestamp } = require("../shared/code-timestamp.js");

const responseWithDate = (value) => ({
  ok: true,
  headers: { get: (name) => name === "Last-Modified" ? value : null },
});

test("the timestamp uses the newest modification reported for the page and its local assets", async () => {
  const requested = [];
  const updated = await newestCodeModification({
    pageUrl: "http://127.0.0.1:8000/tools/system_visualization/beam-visual/beam-segments.html?mode=low",
    pageLastModified: "Sun, 18 Oct 2026 09:00:00 GMT",
    assetUrls: ["../shared/styles.css", "beam-segments.js", "https://cdn.example/app.js"],
    fetcher: async (url, options) => {
      requested.push({ url, options });
      if (url.endsWith("beam-segments.js")) return responseWithDate("Sun, 18 Oct 2026 10:05:06 GMT");
      return responseWithDate("Sun, 18 Oct 2026 09:30:00 GMT");
    },
  });

  assert.equal(updated.toISOString(), "2026-10-18T10:05:06.000Z");
  assert.equal(requested.length, 3);
  assert.ok(requested.every(({ options }) => options.method === "HEAD" && options.cache === "no-store"));
  assert.ok(requested.every(({ url }) => !url.includes("cdn.example")));
});

test("the timestamp falls back to the page date when asset metadata is unavailable", async () => {
  const updated = await newestCodeModification({
    pageUrl: "http://127.0.0.1:8000/tools/system_visualization/code-graph/index.html",
    pageLastModified: "Sun, 18 Oct 2026 09:00:00 GMT",
    assetUrls: ["../shared/styles.css"],
    fetcher: async () => { throw new Error("server unavailable"); },
  });
  assert.equal(updated.toISOString(), "2026-10-18T09:00:00.000Z");
});

test("local time formatting is explicit and invalid dates are reported as unavailable", () => {
  const date = new Date("2026-10-18T10:05:06Z");
  const pad = (number) => String(number).padStart(2, "0");
  assert.equal(formatLocalTimestamp(date),
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`);
  assert.equal(formatLocalTimestamp(null), "unavailable");
});

test("each visualization tab includes the shared timestamp label and loader", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const toolRoot = path.resolve(__dirname, "..");
  for (const page of [
    "code-graph/index.html",
    "system-in-action/index.html",
    "beam-visual/beam-segments.html",
    "can-messages/index.html",
  ]) {
    const html = fs.readFileSync(path.join(toolRoot, page), "utf8");
    assert.match(html, /<time id="codeUpdated" class="code-updated"/);
    assert.match(html, /<script defer src="\.\.\/shared\/code-timestamp\.js"><\/script>/);
    if (page === "can-messages/index.html") {
      assert.match(html, /<script defer src="can-messages\.js"><\/script>/);
    }
  }
});
