/**
 * Declarative container listing for .sxcu configs: a `Container` block turns a
 * service's listing endpoint (notebooks / folders / directories) into a
 * ContainerQuery. Credentials from the target's stored values are filled
 * server-side — they never reach the browser.
 *
 * Two listing modes:
 * - full-list tree (`parentField` set): one paginated fetch of every container,
 *   tree + "A / B" path labels built locally (Joplin /folders).
 * - per-parent lazy (`{{parent}}` in listUrl): one fetch per container, listing
 *   its children (Obsidian /vault/<dir>/).
 */
import type { Container, ContainerQuery, ContainerSpec, TargetConfig } from "../types.ts";
import { fillPlaceholders } from "./engine.ts";

const MAX_PAGES = 50;
const TIMEOUT_MS = 8000;
const MAX_RESPONSE = 4 * 1024 * 1024;

type Vals = Record<string, string>;

function dig(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function fillUrl(spec: ContainerSpec, values: Vals, parent?: string): string {
  // {{parent}} lands in a URL path — encode per segment, keep the slashes.
  const segs = String(parent || "").split("/").map(encodeURIComponent).join("/");
  return fillPlaceholders(String(spec.listUrl || ""), values).replace(/\{\{\s*parent\s*\}\}/gi, segs);
}

function fillHeaders(spec: ContainerSpec, values: Vals): Record<string, string> {
  return Object.fromEntries(Object.entries(spec.headers || {}).map(([k, v]) => [k, fillPlaceholders(v, values)]));
}

/** One listing request → { items, hasMore }. Throws with a compact reason on failure. */
async function fetchPage(spec: ContainerSpec, url: string, values: Vals): Promise<{ items: any[]; hasMore: boolean }> {
  const method = (spec.method || "GET").toUpperCase();
  const headers = fillHeaders(spec, values);
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (method !== "GET" && spec.body) {
    init.body = fillPlaceholders(spec.body, values);
    headers["content-type"] ||= "application/json";
  }
  const resp = await fetch(url, init);
  const text = (await resp.text()).slice(0, MAX_RESPONSE);
  if (!resp.ok) throw new Error(`container list HTTP ${resp.status}: ${text.slice(0, 200) || resp.statusText}`);
  let raw: any;
  try { raw = JSON.parse(text); } catch { throw new Error("container list: response is not JSON"); }
  const items = dig(raw, spec.itemsPath);
  const arr = Array.isArray(items) ? items : Array.isArray(raw) ? raw : [];
  return { items: arr, hasMore: spec.pages ? !!raw?.[spec.pages.moreField] : false };
}

function toContainer(item: any, spec: ContainerSpec, parent?: string, path?: string): Container {
  const idKey = spec.idField || "id";
  // Service titles may carry control chars (Joplin appends \r to folder titles) —
  // display labels must be clean.
  const label = String(item[spec.labelField || "title"] ?? item["name"] ?? item[idKey] ?? "").trim();
  const out: Container = { id: String(item[idKey] ?? ""), label };
  if (parent) out.parent = parent;
  if (path) out.path = path;
  return out;
}

/** Full-list tree mode: one (paginated) fetch, tree + path labels built from parentField. */
async function listTree(spec: ContainerSpec, values: Vals): Promise<Container[]> {
  const all: any[] = [];
  let hasMore = true;
  for (let page = 1; hasMore && page <= MAX_PAGES; page++) {
    let url = fillUrl(spec, values);
    if (spec.pages) url += (url.includes("?") ? "&" : "?") + `${spec.pages.param}=${page}`;
    const r = await fetchPage(spec, url, values);
    all.push(...r.items);
    hasMore = r.hasMore;
  }
  const idKey = spec.idField || "id";
  const labelKey = spec.labelField || "title";
  const parentKey = spec.parentField!;
  const byId = new Map(all.map((it) => [String(it[idKey]), it]));
  const labelOf = (it: any): string => String(it[labelKey] ?? it["name"] ?? it[idKey] ?? "").trim();
  const pathOf = (it: any, seen = new Set<string>()): string => {
    const id = String(it[idKey]);
    const pid = it[parentKey] != null && it[parentKey] !== "" ? String(it[parentKey]) : "";
    const parentNode = pid ? byId.get(pid) : null;
    if (!parentNode || seen.has(id)) return labelOf(it);
    seen.add(id);
    return `${pathOf(parentNode, seen)} / ${labelOf(it)}`;
  };
  return all.map((it) => {
    const pid = it[parentKey] != null && it[parentKey] !== "" ? String(it[parentKey]) : "";
    return toContainer(it, spec, pid || undefined, pathOf(it));
  });
}

/** Per-parent lazy mode: {{parent}} in listUrl scopes the listing to one container. */
async function listChildren(spec: ContainerSpec, values: Vals, parent?: string): Promise<Container[]> {
  const r = await fetchPage(spec, fillUrl(spec, values, parent), values);
  const filter = spec.filter;
  const entries = filter
    ? r.items.filter((it) => Object.entries(filter).every(([k, v]) => String(it[k]) === v))
    : r.items;
  return entries.map((it) => toContainer(it, spec, parent));
}

/** Build the runtime ContainerQuery from a declarative spec. */
export function makeContainerQuery(spec: ContainerSpec): ContainerQuery {
  return {
    field: spec.field,
    ...(spec.label !== undefined ? { label: spec.label } : {}),
    list(cfg: TargetConfig, parent?: string) {
      const values = { ...cfg.values };
      return spec.parentField ? listTree(spec, values) : listChildren(spec, values, parent);
    },
  };
}
