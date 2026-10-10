/* Optional path overlay. The class graph remains the source of nodes and layout. */
(() => {
  "use strict";

  const flows = globalThis.FUNCTIONALITY_FLOWS;
  const graphNodes = new Map(globalThis.CLASS_GRAPH.nodes.map((node) => [node.id, node]));
  const sources = new Map(globalThis.CODE_INDEX.map((node) => [node.id, node]));
  const viewer = globalThis.CODE_GRAPH_VIEWER;
  const $ = (id) => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";
  let active = null;
  let savedControls = null;
  let changingControls = false;

  function svg(tag, attributes, label) {
    const element = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
    if (label !== undefined) element.textContent = label;
    return element;
  }

  function html(tag, className, label) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (label !== undefined) element.textContent = label;
    return element;
  }

  function graphElement(id) {
    return [...$("nodeLayer").children].find((element) =>
      element.getAttribute("data-node-id") === id);
  }

  function visibleNode(id) {
    if (graphElement(id)) return id;
    const parent = graphNodes.get(id)?.parent;
    return parent && graphElement(parent) ? parent : null;
  }

  function point(id) {
    const element = graphElement(id);
    if (!element) return null;
    const transform = element.getAttribute("transform");
    const match = /^translate\(([-\d.]+) ([-\d.]+)\)$/.exec(transform);
    const circle = element.querySelector(".node-circle");
    if (!match || !circle) return null;
    return { x: Number(match[1]), y: Number(match[2]), r: Number(circle.getAttribute("r")) };
  }

  function drawStep(step, index) {
    const fromId = visibleNode(step.from);
    const toId = visibleNode(step.to);
    if (!fromId || !toId) return;
    const from = point(fromId);
    const to = point(toId);
    if (!from || !to) return;
    let path;
    let labelX;
    let labelY;
    if (fromId === toId) {
      path = "M " + (from.x + from.r) + " " + (from.y - 9)
        + " C " + (from.x + from.r + 73) + " " + (from.y - 75)
        + ", " + (from.x + from.r + 73) + " " + (from.y + 75)
        + ", " + (from.x + from.r) + " " + (from.y + 9);
      labelX = from.x + from.r + 70;
      labelY = from.y;
    } else {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const x1 = from.x + ux * (from.r + 7);
      const y1 = from.y + uy * (from.r + 7);
      const x2 = to.x - ux * (to.r + 14);
      const y2 = to.y - uy * (to.r + 14);
      const sign = index % 2 ? 1 : -1;
      const bend = sign * (20 + index % 3 * 11);
      const cx = (x1 + x2) / 2 - uy * bend;
      const cy = (y1 + y2) / 2 + ux * bend;
      path = "M " + x1 + " " + y1 + " Q " + cx + " " + cy + " " + x2 + " " + y2;
      labelX = (x1 + 2 * cx + x2) / 4;
      labelY = (y1 + 2 * cy + y2) / 4;
    }
    const group = svg("g", { class: "functionality-step-edge" });
    group.style.setProperty("--flow-delay", Math.min(index * 140, 1400) + "ms");
    group.append(svg("path", {
      d: path, class: "functionality-path", pathLength: 100,
      "marker-end": "url(#flowArrowHead)",
    }));
    const caption = (index + 1) + " · " + step.action;
    const width = Math.max(60, caption.length * 8 + 18);
    group.append(svg("rect", {
      x: labelX - width / 2, y: labelY - 16, width, height: 29, rx: 14,
      class: "functionality-label-bg",
    }));
    group.append(svg("text", {
      x: labelX, y: labelY + 4, class: "functionality-label",
      "text-anchor": "middle",
    }, caption));
    $("functionalityEdges").append(group);
  }

  function renderOverlay() {
    const nodeElements = [...$("nodeLayer").children];
    const highlighted = new Set();
    if (active) {
      for (const step of active.steps) {
        const from = visibleNode(step.from);
        const to = visibleNode(step.to);
        if (from) highlighted.add(from);
        if (to) highlighted.add(to);
      }
    }
    for (const element of nodeElements) {
      const id = element.getAttribute("data-node-id");
      element.classList.toggle("flow-active", active && highlighted.has(id));
      element.classList.toggle("flow-muted", active && !highlighted.has(id));
    }
    $("treeEdges").classList.toggle("flow-mode", Boolean(active));
    $("functionalityEdges").replaceChildren();
    $("functionalityBadges").replaceChildren();
    if (!active) return;
    active.steps.forEach(drawStep);
    const first = visibleNode(active.steps[0].from);
    const start = first && point(first);
    if (start) {
      const badge = svg("g", { class: "functionality-start" });
      badge.append(svg("rect", {
        x: start.x - 29, y: start.y - start.r - 39, width: 58, height: 22, rx: 11,
      }));
      badge.append(svg("text", {
        x: start.x, y: start.y - start.r - 24, "text-anchor": "middle",
      }, "START"));
      $("functionalityBadges").append(badge);
    }
  }

  function routeIds(flow) {
    return [...new Set(flow.steps.flatMap((step) => [step.from, step.to]))];
  }

  function renderSidebar() {
    const list = $("functionalityList");
    list.replaceChildren();
    for (const flow of flows) {
      const button = html("button", "functionality-option" + (active?.id === flow.id ? " active" : ""));
      button.type = "button";
      button.setAttribute("aria-pressed", String(active?.id === flow.id));
      button.append(html("strong", "", flow.title));
      button.append(html("small", "", flow.summary));
      button.addEventListener("click", () => {
        if (active?.id === flow.id) clearFlow(true);
        else selectFlow(flow);
      });
      list.append(button);
    }
    $("clearFunctionality").hidden = !active;
    $("functionalityDetail").hidden = !active;
    if (!active) return;
    $("functionalityTitle").textContent = active.title;
    $("functionalitySummary").textContent = active.summary;
    const steps = $("functionalitySteps");
    steps.replaceChildren();
    active.steps.forEach((step, index) => {
      const item = html("li");
      const jump = html("button", "functionality-step-jump",
        graphNodes.get(step.from).label + " → " + graphNodes.get(step.to).label);
      jump.type = "button";
      jump.title = "Focus this action in the graph";
      jump.addEventListener("click", () => viewer.revealPath([step.from, step.to]));
      item.append(html("span", "functionality-step-number", String(index + 1)), jump);
      item.append(html("span", "functionality-step-action", step.action + " · " + step.detail));
      const source = sources.get(step.evidence);
      if (source) {
        const link = html("a", "functionality-source", "Source");
        link.href = "../../" + source.path + (source.line ? "#L" + source.line : "");
        link.target = "_blank";
        link.rel = "noopener";
        item.append(link);
      }
      steps.append(item);
    });
  }

  function clearFlow(restoreControls) {
    if (!active) return;
    active = null;
    renderSidebar();
    renderOverlay();
    if (restoreControls && savedControls) {
      changingControls = true;
      $("layerFilter").value = savedControls.layer;
      $("layerFilter").dispatchEvent(new Event("change"));
      $("graphSearch").value = savedControls.search;
      $("graphSearch").dispatchEvent(new Event("input"));
      changingControls = false;
    }
    savedControls = null;
  }

  function selectFlow(flow) {
    if (!active) {
      savedControls = {
        search: $("graphSearch").value,
        layer: $("layerFilter").value,
      };
    }
    changingControls = true;
    if ($("graphSearch").value) {
      $("graphSearch").value = "";
      $("graphSearch").dispatchEvent(new Event("input"));
    }
    if ($("layerFilter").value !== "all") {
      $("layerFilter").value = "all";
      $("layerFilter").dispatchEvent(new Event("change"));
    }
    changingControls = false;
    active = flow;
    viewer.revealPath(routeIds(flow));
    renderSidebar();
    renderOverlay();
  }

  $("clearFunctionality").addEventListener("click", () => clearFlow(true));
  $("resetGraph").addEventListener("click", () => clearFlow(false));
  $("graphSearch").addEventListener("input", () => {
    if (!changingControls) clearFlow(false);
  });
  $("layerFilter").addEventListener("change", () => {
    if (!changingControls) clearFlow(false);
  });
  new MutationObserver(() => {
    if (active) renderOverlay();
  }).observe($("nodeLayer"), { childList: true });
  renderSidebar();
})();
