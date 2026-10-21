(() => {
  "use strict";

  const parseTimestamp = (value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  const newestCodeModification = async ({ pageUrl, pageLastModified, assetUrls, fetcher }) => {
    const page = new URL(pageUrl);
    const timestamps = [];
    const pageTimestamp = parseTimestamp(pageLastModified);
    if (pageTimestamp !== null) timestamps.push(pageTimestamp);

    const urls = new Set([page.href, ...assetUrls]);
    const responses = await Promise.all([...urls].map(async (url) => {
      try {
        const resource = new URL(url, page.href);
        if (resource.origin !== page.origin || !["http:", "https:"].includes(resource.protocol)) {
          return null;
        }
        const response = await fetcher(resource.href, { method: "HEAD", cache: "no-store" });
        if (!response.ok) return null;
        return parseTimestamp(response.headers.get("Last-Modified"));
      } catch {
        return null;
      }
    }));

    for (const timestamp of responses) {
      if (timestamp !== null) timestamps.push(timestamp);
    }
    return timestamps.length ? new Date(Math.max(...timestamps)) : null;
  };

  const formatLocalTimestamp = (date) => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "unavailable";
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
      + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const updateTimestamp = async () => {
    const display = document.getElementById("codeUpdated");
    if (!display) return;

    const assetUrls = Array.from(
      document.querySelectorAll('script[src], link[rel~="stylesheet"][href]'),
      (element) => element.src || element.href,
    ).filter(Boolean);
    const updated = await newestCodeModification({
      pageUrl: window.location.href,
      pageLastModified: document.lastModified,
      assetUrls,
      fetcher: window.fetch.bind(window),
    });

    if (!updated) {
      display.textContent = "Code updated: unavailable";
      display.removeAttribute("datetime");
      return;
    }
    display.dateTime = updated.toISOString();
    display.textContent = `Code updated · ${formatLocalTimestamp(updated)}`;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { newestCodeModification, formatLocalTimestamp };
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    void updateTimestamp();
  }
})();
