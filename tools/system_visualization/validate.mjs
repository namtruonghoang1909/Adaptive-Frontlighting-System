import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const context = vm.createContext({});
context.globalThis = context;
for (const file of ["code-index.js", "graph-data.js", "functionality-data.js"]) {
  vm.runInContext(readFileSync(resolve(toolDirectory, file), "utf8"), context, { filename: file });
}
const inventory = context.CODE_INDEX;
const graph = context.CLASS_GRAPH;
const functionalities = context.FUNCTIONALITY_FLOWS;
const failures = [];
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

requireValue(Array.isArray(inventory) && inventory.length > 0, "Source inventory must be nonempty");
requireValue(graph && Array.isArray(graph.layers) && Array.isArray(graph.nodes) && Array.isArray(graph.edges), "CLASS_GRAPH must contain layers, nodes, and edges");
if (!inventory || !graph) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const sources = new Map(inventory.map((node) => [node.id, node]));
requireValue(sources.size === inventory.length, "Duplicate source inventory IDs");
requireValue(inventory.filter((node) => node.parent === null).length === 1, "Source inventory needs one root");
requireValue(sources.get("repository")?.parent === null, "Repository must be the source inventory root");
for (const source of inventory) {
  requireValue(source.id && source.label && source.path, source.id + ": missing source identity");
  requireValue(["implemented", "planned"].includes(source.status), source.id + ": invalid status");
  requireValue(/^#[0-9a-f]{6}$/i.test(source.color), source.id + ": invalid color");
  requireValue(["repository", "component", "module", "file", "class", "function", "method"].includes(source.kind), source.id + ": invalid kind");
  const path = resolve(repositoryRoot, source.path);
  requireValue(path === repositoryRoot || path.startsWith(repositoryRoot + "/"), source.id + ": path escapes repository");
  requireValue(existsSync(path), source.id + ": source path is missing");
  if (source.line !== undefined) {
    requireValue(Number.isInteger(source.line) && source.line > 0, source.id + ": invalid line");
    if (existsSync(path)) requireValue(source.line <= readFileSync(path, "utf8").split("\n").length, source.id + ": line outside source");
  }
  const visited = new Set([source.id]);
  let parent = source.parent;
  while (parent) {
    requireValue(sources.has(parent), source.id + ": missing inventory parent " + parent);
    requireValue(!visited.has(parent), source.id + ": inventory containment cycle");
    if (!sources.has(parent) || visited.has(parent)) break;
    visited.add(parent);
    parent = sources.get(parent).parent;
  }
}

const layers = new Map(graph.layers.map((layer) => [layer.id, layer]));
const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
requireValue(layers.size === graph.layers.length, "Duplicate layer IDs");
requireValue(nodes.size === graph.nodes.length, "Duplicate graph node IDs");
requireValue(graph.layout && typeof graph.layout === "object", "Graph needs curated parent positions");
requireValue(graph.layers.length >= 6, "Expected project layer clusters");
for (const layer of graph.layers) {
  requireValue(layer.id && layer.label && layer.folder && layer.description, layer.id + ": missing layer detail");
  requireValue(/^#[0-9a-f]{6}$/i.test(layer.color), layer.id + ": invalid color");
  requireValue(["implemented", "planned"].includes(layer.status), layer.id + ": invalid status");
  const path = resolve(repositoryRoot, layer.folder);
  requireValue(path.startsWith(repositoryRoot + "/") && existsSync(path), layer.id + ": missing layer folder");
  if (layer.status === "planned") {
    requireValue(!graph.nodes.some((node) => node.layer === layer.id), layer.id + ": planned layer has invented runtime nodes");
  }
}
for (const node of graph.nodes) {
  requireValue(node.id && node.label && node.description && node.source, node.id + ": missing node detail");
  requireValue(["class", "function", "method", "field"].includes(node.kind), node.id + ": invalid kind");
  const source = sources.get(node.source);
  requireValue(Boolean(source), node.id + ": unknown source " + node.source);
  if (node.parent) {
    const parent = nodes.get(node.parent);
    requireValue(Boolean(parent) && !parent.parent, node.id + ": child must have one top-level parent");
    requireValue(node.kind === "method" || node.kind === "field" || node.kind === "function", node.id + ": invalid child kind");
    if (parent) requireValue(source?.path === sources.get(parent.source)?.path, node.id + ": child source differs from parent file");
    if (node.kind === "method") requireValue(source?.kind === "method", node.id + ": method must map to indexed method");
    if (node.kind === "field") {
      requireValue(parent?.kind === "class", node.id + ": field requires class parent");
      requireValue(source?.id === parent?.source, node.id + ": field must map to its containing class");
      const fileText = source && readFileSync(resolve(repositoryRoot, source.path), "utf8");
      requireValue(Boolean(fileText && new RegExp("\\b" + node.label + "\\s*:").test(fileText)), node.id + ": field missing from source");
    }
  } else {
    requireValue(layers.has(node.layer), node.id + ": unknown layer");
    requireValue(layers.get(node.layer)?.status === "implemented", node.id + ": graph node in unimplemented layer");
    const point = graph.layout?.[node.id];
    requireValue(Array.isArray(point) && point.length === 2
      && point.every((value) => Number.isFinite(value) && value > 0),
    node.id + ": missing or invalid layout position");
    if (source?.kind === "file") {
      requireValue(node.kind === "function" && source.path.endsWith(".js"), node.id + ": only browser functions may map to a file");
      if (source.path.endsWith(".js")) {
        const text = readFileSync(resolve(repositoryRoot, source.path), "utf8");
        requireValue(text.includes("function " + node.label.replace(/\(\)$/, "(")), node.id + ": browser function missing from source");
      }
    } else {
      requireValue(source?.kind === node.kind, node.id + ": source kind differs from graph kind");
    }
  }
}
for (const id of Object.keys(graph.layout || {})) {
  requireValue(nodes.has(id) && !nodes.get(id)?.parent, id + ": layout position needs a parent node");
}
for (const edge of graph.edges) {
  requireValue(nodes.has(edge.from) && nodes.has(edge.to), edge.from + " → " + edge.to + ": unknown endpoint");
  requireValue(edge.from !== edge.to, edge.from + ": self edge");
  requireValue(["call", "data"].includes(edge.kind), edge.from + " → " + edge.to + ": invalid edge kind");
  requireValue(Boolean(edge.label && sources.has(edge.evidence)), edge.from + " → " + edge.to + ": missing edge label/evidence");
}
const edgeKeys = graph.edges.map((edge) => edge.from + "|" + edge.to + "|" + edge.kind);
requireValue(new Set(edgeKeys).size === edgeKeys.length, "Duplicate directed edge");
requireValue(graph.nodes.some((node) => node.kind === "class"), "Class graph has no classes");
requireValue(graph.edges.some((edge) => edge.from === "scene" && edge.to === "write"), "Missing scene publication interaction");
requireValue(graph.edges.some((edge) => edge.from === "poll" && edge.to === "draw"), "Missing browser scene interaction");
requireValue(Array.isArray(functionalities) && functionalities.length >= 6,
  "Expected implemented functionality paths");
const functionalityIds = new Set();
for (const flow of functionalities || []) {
  requireValue(typeof flow.id === "string" && flow.id.length > 0,
    "Functionality needs an ID");
  requireValue(!functionalityIds.has(flow.id), flow.id + ": duplicate functionality ID");
  functionalityIds.add(flow.id);
  requireValue(typeof flow.title === "string" && flow.title.length > 0 &&
    typeof flow.summary === "string" && flow.summary.length > 0,
  flow.id + ": missing title or summary");
  requireValue(Array.isArray(flow.steps) && flow.steps.length >= 3,
    flow.id + ": expected ordered actions");
  for (const [index, step] of (flow.steps || []).entries()) {
    const prefix = flow.id + " step " + (index + 1);
    requireValue(nodes.has(step.from) && nodes.has(step.to), prefix + ": unknown graph node");
    requireValue(step.from !== step.to, prefix + ": action must connect two nodes");
    requireValue(typeof step.action === "string" && step.action.length > 0 &&
      typeof step.detail === "string" && step.detail.length > 0,
    prefix + ": missing action or passed values");
    requireValue(sources.has(step.evidence) && sources.get(step.evidence)?.status === "implemented",
      prefix + ": missing implemented source evidence");
  }
}
for (const required of ["ego_extraction", "surrounding_extraction",
  "scene_publication", "browser_display", "manual_control"]) {
  requireValue(functionalityIds.has(required), "Missing important functionality: " + required);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Graph valid: " + inventory.length + " inventory nodes, " + graph.nodes.length
  + " class/function/member nodes, " + graph.edges.length + " interactions, "
  + graph.layers.length + " layer clusters, " + functionalities.length + " functionality paths.");
