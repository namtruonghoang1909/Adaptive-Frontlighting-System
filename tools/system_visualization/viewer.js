/* Class graph: clustered circles, explicit interactions, and collapsible members. */
(() => {
  "use strict";

  const graph = globalThis.CLASS_GRAPH;
  const inventory = new Map((globalThis.CODE_INDEX || []).map((entry) => [entry.id, entry]));
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const layers = new Map(graph.layers.map((layer) => [layer.id, layer]));
  const children = new Map(graph.nodes.filter((node) => !node.parent).map((node) => [node.id, []]));
  for (const node of graph.nodes) {
    if (node.parent) children.get(node.parent).push(node.id);
  }
  const $ = (id) => document.getElementById(id);
  const stage = $("codeGraph");
  const svgNS = "http://www.w3.org/2000/svg";
  const parentRadius = 54;
  const childRadius = 36;
  const panelWidth = 1200;
  const panelGap = 40;
  const memberOffset = 145;
  const readableScale = .9;
  const expanded = new Set();
  const positions = new Map();
  const displayedEdges = [];
  let visible = new Set();
  let panels = [];
  let selectedId = null;
  let camera = { x: 0, y: 0, scale: 1 };
  let animation = null;
  let drag = null;
  let moved = false;

  function svg(tag, attributes, label) {
    const element = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes || {})) {
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

  function layerOf(node) {
    return layers.get(node.layer || nodes.get(node.parent).layer);
  }

  function colorOf(node) {
    const layer = layerOf(node);
    if (node.parent) return colorOf(nodes.get(node.parent));
    const peers = graph.nodes.filter((entry) => !entry.parent && entry.layer === layer.id);
    const index = peers.findIndex((entry) => entry.id === node.id);
    const color = layer.color.slice(1);
    const red = parseInt(color.slice(0, 2), 16);
    const green = parseInt(color.slice(2, 4), 16);
    const blue = parseInt(color.slice(4, 6), 16);
    const offset = index * 7 - (peers.length - 1) * 3.5;
    const channel = (value) => Math.max(0, Math.min(255, Math.round(value + offset)));
    return "#" + [red, green, blue].map((value) => channel(value).toString(16).padStart(2, "0")).join("");
  }

  function labelLines(label, radius) {
    const max = radius === childRadius ? 9 : 12;
    const words = label.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").split(/\s+/);
    const lines = [];
    let line = "";
    for (let word of words) {
      while (word.length > max) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(word.slice(0, max));
        word = word.slice(max);
      }
      if (line && (line + " " + word).length > max) {
        lines.push(line);
        line = word;
      } else {
        line += (line ? " " : "") + word;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, radius === childRadius ? 3 : 5);
  }

  function searchMatches(node, query) {
    if (!query) return true;
    const layer = layerOf(node);
    return node.label.toLowerCase().includes(query)
      || layer.label.toLowerCase().includes(query)
      || layer.folder.toLowerCase().includes(query)
      || (children.get(node.id) || []).some((childId) =>
        nodes.get(childId).label.toLowerCase().includes(query));
  }

  function buildLayout() {
    positions.clear();
    visible = new Set();
    panels = [];
    const query = $("graphSearch").value.trim().toLowerCase();
    const layerFilter = $("layerFilter").value;
    const compact = Boolean(query) || layerFilter !== "all";
    const available = graph.layers.filter((layer) => layerFilter === "all" || layer.id === layerFilter);
    const groups = available.map((layer) => {
      const members = graph.nodes.filter((node) =>
        !node.parent && node.layer === layer.id && searchMatches(node, query));
      const xShift = compact && members.length
        ? Math.min(...members.map((node) => graph.layout[node.id][0])) - 200 : 0;
      const yShift = compact && members.length
        ? Math.min(...members.map((node) => graph.layout[node.id][1])) - 260 : 0;
      const height = members.length
        ? Math.max(220, ...members.map((node) =>
          graph.layout[node.id][1] - yShift + memberOffset + childRadius + 50))
        : 220;
      return { layer, members, xShift, yShift, height };
    }).filter(({ layer, members }) =>
      !query || members.length || layer.label.toLowerCase().includes(query)
      || layer.folder.toLowerCase().includes(query));
    const implemented = groups.filter(({ layer }) => layer.status === "implemented");
    const planned = groups.filter(({ layer }) => layer.status === "planned");
    const topHeight = Math.max(0, ...implemented.map(({ height }) => height));
    for (const [row, rowGroups] of [[0, implemented], [1, planned]]) {
      rowGroups.forEach(({ layer, members, xShift, yShift, height }, index) => {
        const x = index * (panelWidth + panelGap);
        const y = row === 0 ? 0 : (implemented.length ? topHeight + panelGap : 0);
        panels.push({ layer, x, y, width: panelWidth, height, members });
        members.forEach((node) => {
          const [localX, localY] = graph.layout[node.id];
          const centerX = x + localX - xShift;
          const centerY = y + localY - yShift;
          positions.set(node.id, { x: centerX, y: centerY, radius: parentRadius });
          visible.add(node.id);
          if (!expanded.has(node.id)) return;
          const nested = children.get(node.id) || [];
          nested.forEach((childId, childIndex) => {
            const angle = nested.length === 1 ? 0
              : -Math.PI / 2 + childIndex * Math.PI * 2 / nested.length;
            positions.set(childId, {
              x: centerX + Math.cos(angle) * memberOffset,
              y: centerY + Math.sin(angle) * memberOffset,
              radius: childRadius,
            });
            visible.add(childId);
          });
        });
      });
    }
    if (selectedId && !visible.has(selectedId)) selectedId = null;
  }

  function visibleEndpoint(id) {
    if (visible.has(id)) return id;
    const node = nodes.get(id);
    return node && node.parent && visible.has(node.parent) ? node.parent : null;
  }

  function buildEdges() {
    displayedEdges.length = 0;
    const seen = new Set();
    for (const childId of visible) {
      const node = nodes.get(childId);
      if (!node.parent) continue;
      displayedEdges.push({ from: node.parent, to: childId, label: "member", kind: "member" });
    }
    for (const edge of graph.edges) {
      const from = visibleEndpoint(edge.from);
      const to = visibleEndpoint(edge.to);
      if (!from || !to || from === to) continue;
      const key = from + "|" + to + "|" + edge.kind;
      if (seen.has(key)) continue;
      seen.add(key);
      displayedEdges.push({ ...edge, from, to });
    }
  }

  function focusedIds() {
    if (!selectedId) return null;
    const family = new Set([selectedId, ...(children.get(selectedId) || []).filter((id) => visible.has(id))]);
    const focus = new Set(family);
    for (const edge of displayedEdges) {
      if (family.has(edge.from)) focus.add(edge.to);
      if (family.has(edge.to)) focus.add(edge.from);
    }
    for (const id of [...focus]) {
      const parent = nodes.get(id).parent;
      if (parent) focus.add(parent);
    }
    return focus;
  }

  function renderPanels() {
    const target = $("clusterLayer");
    target.replaceChildren();
    for (const panel of panels) {
      const group = svg("g", { class: "cluster" });
      const border = svg("rect", {
        x: panel.x, y: panel.y, width: panel.width, height: panel.height,
        rx: 18, class: "cluster-outline" + (panel.layer.status === "planned" ? " planned" : ""),
        stroke: panel.layer.color,
      });
      group.append(border);
      group.append(svg("rect", {
        x: panel.x + 20, y: panel.y + 23, width: 7, height: 25,
        rx: 3, fill: panel.layer.color,
      }));
      group.append(svg("text", {
        x: panel.x + 40, y: panel.y + 43, class: "cluster-name",
      }, panel.layer.label));
      group.append(svg("text", {
        x: panel.x + 22, y: panel.y + 69, class: "cluster-folder",
      }, panel.layer.folder));
      if (panel.layer.status === "planned") {
        group.append(svg("text", {
          x: panel.x + 25, y: panel.y + 145, class: "cluster-empty",
        }, "No implemented runtime classes"));
      }
      target.append(group);
    }
  }

  function edgeGeometry(from, to) {
    const a = positions.get(from);
    const b = positions.get(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const x1 = a.x + ux * (a.radius + 4);
    const y1 = a.y + uy * (a.radius + 4);
    const x2 = b.x - ux * (b.radius + 8);
    const y2 = b.y - uy * (b.radius + 8);
    return { x1, y1, x2, y2 };
  }

  function renderEdges(focus) {
    const target = $("treeEdges");
    target.replaceChildren();
    const family = new Set(selectedId ? [selectedId, ...(children.get(selectedId) || []).filter((id) => visible.has(id))] : []);
    for (const edge of displayedEdges) {
      const active = !focus || family.has(edge.from) || family.has(edge.to)
        || (edge.kind === "member" && focus.has(edge.from) && focus.has(edge.to));
      const { x1, y1, x2, y2 } = edgeGeometry(edge.from, edge.to);
      const group = svg("g", {
        class: "edge-group" + (!active ? " dimmed" : "") + (active && focus ? " active" : ""),
      });
      group.append(svg("line", {
        x1, y1, x2, y2,
        class: "interaction-edge " + edge.kind,
        "marker-end": edge.kind === "member" ? "" : "url(#arrowHead)",
      }));
      if (active && focus && edge.kind !== "member") {
        const offset = Math.abs(y2 - y1) < 20 ? -10 : 0;
        group.append(svg("text", {
          x: (x1 + x2) / 2, y: (y1 + y2) / 2 + offset,
          class: "edge-label", "text-anchor": "middle",
        }, edge.label));
      }
      target.append(group);
    }
  }

  function renderNodes(focus) {
    const target = $("nodeLayer");
    target.replaceChildren();
    for (const id of visible) {
      const node = nodes.get(id);
      const point = positions.get(id);
      const expandable = (children.get(id) || []).length > 0;
      const dimmed = focus && !focus.has(id);
      const group = svg("g", {
        class: "graph-node" + (node.parent ? " child" : " parent")
          + (selectedId === id ? " selected" : "") + (dimmed ? " dimmed" : ""),
        transform: "translate(" + point.x + " " + point.y + ")",
        tabindex: "0", role: "button", "data-node-id": id,
        "aria-label": node.label + (expandable ? (expanded.has(id) ? ", collapse members" : ", expand members") : ", show details"),
        "aria-pressed": String(selectedId === id),
      });
      group.style.setProperty("--node-color", colorOf(node));
      group.append(svg("circle", { r: point.radius, class: "node-circle" }));
      const lines = labelLines(node.label, point.radius);
      const fontSize = node.parent ? 13 : 15;
      const lineHeight = node.parent ? 15 : 17;
      const startY = -(lines.length - 1) * lineHeight / 2 + fontSize * .35;
      const text = svg("text", { class: "node-title", "font-size": fontSize });
      lines.forEach((line, index) => text.append(svg("tspan", {
        x: 0, y: startY + index * lineHeight,
      }, line)));
      group.append(text);
      if (expandable) {
        group.append(svg("circle", { cx: point.radius * .68, cy: -point.radius * .68, r: 11, class: "node-toggle-bg" }));
        group.append(svg("text", {
          x: point.radius * .68, y: -point.radius * .68 + 4, class: "node-toggle",
        }, expanded.has(id) ? "−" : "+"));
      }
      group.addEventListener("click", () => {
        if (!moved) activate(id);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(id);
        }
      });
      target.append(group);
    }
  }

  function renderDetails() {
    const node = selectedId ? nodes.get(selectedId) : null;
    $("detailEmpty").hidden = Boolean(node);
    $("detailContent").hidden = !node;
    if (!node) return;
    const layer = layerOf(node);
    $("detailKind").textContent = layer.label + " / " + node.kind;
    $("detailTitle").textContent = node.label;
    $("detailDescription").textContent = node.description;
    const connections = $("detailConnections");
    connections.replaceChildren();
    const family = new Set([node.id, ...(children.get(node.id) || []).filter((id) => visible.has(id))]);
    const incoming = displayedEdges.filter((edge) => family.has(edge.to) && !family.has(edge.from) && edge.kind !== "member");
    const outgoing = displayedEdges.filter((edge) => family.has(edge.from) && !family.has(edge.to) && edge.kind !== "member");
    for (const [heading, edges, other] of [
      ["Upstream", incoming, "from"], ["Downstream", outgoing, "to"],
    ]) {
      if (!edges.length) continue;
      connections.append(html("h2", "connection-heading", heading));
      const list = html("ul", "connection-list");
      for (const edge of edges) {
        const item = html("li");
        const button = html("button", "connection-link", nodes.get(edge[other]).label);
        button.type = "button";
        button.addEventListener("click", () => activate(edge[other], false));
        const via = edge[heading === "Upstream" ? "to" : "from"];
        const detail = via === node.id ? edge.label : nodes.get(via).label + " · " + edge.label;
        item.append(button, html("span", "connection-type", " · " + detail));
        list.append(item);
      }
      connections.append(list);
    }
    const source = inventory.get(node.source);
    const target = $("detailSources");
    target.replaceChildren();
    if (source) {
      const link = html("a", "source-link", source.path + (source.line ? ":" + source.line : ""));
      link.href = "../../" + source.path + (source.line ? "#L" + source.line : "");
      link.target = "_blank";
      link.rel = "noopener";
      target.append(link);
    }
  }

  function render() {
    buildLayout();
    buildEdges();
    const focus = focusedIds();
    renderPanels();
    renderEdges(focus);
    renderNodes(focus);
    renderDetails();
    const topCount = [...visible].filter((id) => !nodes.get(id).parent).length;
    $("mapStatus").textContent = topCount
      ? topCount + " classes and functions shown · click to focus and expand"
      : "No matching classes or functions";
  }

  function activate(id, toggle = true) {
    const node = nodes.get(id);
    if (node.parent && !visible.has(id)) expanded.add(node.parent);
    if (toggle && children.get(id)?.length) {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
    }
    selectedId = id;
    render();
    if (visible.has(id)) centerOn(id);
  }

  function applyCamera() {
    $("graphViewport").setAttribute("transform",
      "translate(" + camera.x + " " + camera.y + ") scale(" + camera.scale + ")");
    $("zoomLevel").textContent = Math.round(camera.scale * 100) + "%";
  }

  function animateCamera(next, duration = 220) {
    if (animation !== null) cancelAnimationFrame(animation);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || duration === 0) {
      camera = next;
      applyCamera();
      return;
    }
    const start = { ...camera };
    const started = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera = {
        x: start.x + (next.x - start.x) * eased,
        y: start.y + (next.y - start.y) * eased,
        scale: start.scale + (next.scale - start.scale) * eased,
      };
      applyCamera();
      animation = progress < 1 ? requestAnimationFrame(frame) : null;
    }
    animation = requestAnimationFrame(frame);
  }

  function fit() {
    if (!panels.length) return;
    const minX = Math.min(...panels.map((panel) => panel.x)) - 35;
    const minY = Math.min(...panels.map((panel) => panel.y)) - 35;
    const maxX = Math.max(...panels.map((panel) => panel.x + panel.width)) + 35;
    const maxY = Math.max(...panels.map((panel) => panel.y + panel.height)) + 35;
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height - 48);
    const scale = Math.max(.08, Math.min(1.2, (width - 24) / (maxX - minX), (height - 24) / (maxY - minY)));
    animateCamera({
      scale,
      x: (width - (maxX - minX) * scale) / 2 - minX * scale,
      y: (height - (maxY - minY) * scale) / 2 - minY * scale,
    });
  }

  function readableView() {
    if (!panels.length) return;
    const first = panels[0];
    const firstNode = first.members[0] && positions.get(first.members[0].id);
    const rect = stage.getBoundingClientRect();
    const height = Math.max(1, rect.height - 48);
    const x = firstNode?.x ?? first.x + 200;
    const y = firstNode?.y ?? first.y + 80;
    animateCamera({
      scale: readableScale,
      x: Math.min(24 - first.x * readableScale, rect.width / 2 - x * readableScale),
      y: Math.min(24 - first.y * readableScale, height / 2 - y * readableScale),
    });
  }

  function centerOn(id) {
    const point = positions.get(id);
    if (!point) return;
    const rect = stage.getBoundingClientRect();
    const scale = Math.max(camera.scale, readableScale);
    animateCamera({
      scale,
      x: rect.width / 2 - point.x * scale,
      y: (rect.height - 48) / 2 - point.y * scale,
    });
  }

  function zoom(factor, clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scale = Math.max(.08, Math.min(3, camera.scale * factor));
    animateCamera({
      scale,
      x: x - (x - camera.x) * scale / camera.scale,
      y: y - (y - camera.y) * scale / camera.scale,
    }, 120);
  }

  for (const layer of graph.layers) {
    const option = html("option", "", layer.label + " · " + layer.folder);
    option.value = layer.id;
    $("layerFilter").append(option);
  }

  $("graphSearch").addEventListener("input", () => {
    const query = $("graphSearch").value.trim().toLowerCase();
    for (const node of graph.nodes) {
      if (node.parent && node.label.toLowerCase().includes(query) && query) expanded.add(node.parent);
    }
    render();
    readableView();
  });
  $("layerFilter").addEventListener("change", () => {
    render();
    readableView();
  });
  $("resetGraph").addEventListener("click", () => {
    expanded.clear();
    selectedId = null;
    $("graphSearch").value = "";
    $("layerFilter").value = "all";
    render();
    readableView();
  });
  $("fitGraph").addEventListener("click", fit);
  $("zoomIn").addEventListener("click", () => {
    const rect = stage.getBoundingClientRect();
    zoom(1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  $("zoomOut").addEventListener("click", () => {
    const rect = stage.getBoundingClientRect();
    zoom(1 / 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom(Math.exp(-event.deltaY * .001), event.clientX, event.clientY);
  }, { passive: false });
  stage.addEventListener("pointerdown", (event) => {
    moved = false;
    if (event.button !== 0 || event.target.closest(".graph-node")) return;
    if (animation !== null) cancelAnimationFrame(animation);
    drag = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    camera.x = drag.cameraX + dx;
    camera.y = drag.cameraY + dy;
    applyCamera();
  });
  stage.addEventListener("pointerup", () => { drag = null; });
  stage.addEventListener("pointercancel", () => { drag = null; });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      $("graphSearch").focus();
    }
    if (event.key === "Escape" && selectedId) {
      selectedId = null;
      render();
    }
  });
  window.addEventListener("resize", readableView);

  // Additive integration point for optional overlays; normal graph handlers stay unchanged.
  globalThis.CODE_GRAPH_VIEWER = Object.freeze({
    revealPath(ids) {
      for (const id of ids) {
        const node = nodes.get(id);
        if (node?.parent) expanded.add(node.parent);
      }
      render();
      const points = ids.map((id) => positions.get(id)).filter(Boolean);
      if (!points.length) return;
      const minX = Math.min(...points.map((point) => point.x - point.radius)) - 80;
      const maxX = Math.max(...points.map((point) => point.x + point.radius)) + 80;
      const minY = Math.min(...points.map((point) => point.y - point.radius)) - 80;
      const maxY = Math.max(...points.map((point) => point.y + point.radius)) + 80;
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height - 48);
      const scale = Math.max(readableScale, Math.min(1.05,
        (width - 32) / (maxX - minX), (height - 32) / (maxY - minY)));
      const first = points[0];
      const fits = (maxX - minX) * scale <= width - 32
        && (maxY - minY) * scale <= height - 32;
      animateCamera({
        scale,
        x: fits ? (width - (maxX - minX) * scale) / 2 - minX * scale
          : width / 2 - first.x * scale,
        y: fits ? (height - (maxY - minY) * scale) / 2 - minY * scale
          : height / 2 - first.y * scale,
      });
    },
  });

  render();
  requestAnimationFrame(readableView);
})();
