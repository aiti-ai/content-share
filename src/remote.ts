/**
 * Remote catalog overlay — same pattern as aiti-model-wizard's catalog/affiliate
 * loader: central JSON URL → disk cache with TTL → stale cache → bundled file.
 * The pi-web extension can point `url` at a maintained aiti.pw endpoint.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CatalogEntry, LocalizedText } from "./types.ts";

export interface RemoteOverlay {
  recommended?: string[];
  status?: Record<string, CatalogEntry["status"]>;
  note?: Record<string, LocalizedText>;
  /** Bilingual display labels shared by all entries (verdicts / availability states). */
  labels?: Record<string, LocalizedText>;
  entries?: CatalogEntry[];
}

export interface RemoteOptions {
  url: string;
  cacheDir: string;
  ttlMs?: number;
  fetchImpl?: typeof fetch;
}

export interface RemoteResult {
  overlay: RemoteOverlay;
  source: "network" | "cache" | "none";
  ageMs?: number;
}

let inflight: Promise<RemoteResult> | null = null;

/**
 * Accept both overlay shapes at the remote URL:
 *  - classic: { recommended?, status?, note?, labels?, entries? }
 *  - published audit doc (aiti.pw /share-targets.json): { providers: [{ id, verdict, note, ... }], setupProviders?, labels? }
 *    → verdict "dead"/"vpn-unreachable"/"template" map to status "dead"; bilingual notes pass through.
 */
export function overlayFromDoc(doc: unknown): RemoteOverlay {
  const d = doc as Record<string, unknown>;
  if (!Array.isArray(d?.providers)) return (doc as RemoteOverlay) ?? {};
  const DEAD_VERDICTS = new Set(["dead", "vpn-unreachable", "template"]);
  const status: Record<string, CatalogEntry["status"]> = {};
  const note: Record<string, LocalizedText> = {};
  for (const raw of d.providers as Array<Record<string, unknown>>) {
    const id = String(raw?.id || "");
    if (!id) continue;
    if (DEAD_VERDICTS.has(String(raw?.verdict))) status[id] = "dead";
    if (raw?.note) note[id] = raw.note as LocalizedText;
  }
  for (const raw of (Array.isArray(d?.setupProviders) ? d.setupProviders : []) as Array<Record<string, unknown>>) {
    const id = String(raw?.id || "");
    if (id && raw?.note) note[id] = raw.note as LocalizedText;
  }
  const labels = (d?.labels ?? undefined) as Record<string, LocalizedText> | undefined;
  return { status, note, ...(labels ? { labels } : {}) };
}

async function readCache(file: string): Promise<RemoteResult | null> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as { at: number; overlay: RemoteOverlay };
    return { overlay: raw.overlay, source: "cache", ageMs: Date.now() - raw.at };
  } catch { return null; }
}

/** Load the remote overlay (single-flight; pass force=true to bypass TTL). */
export async function loadOverlay(opts: RemoteOptions, force = false): Promise<RemoteResult> {
  if (!opts.url) return { overlay: {}, source: "none" };
  if (inflight) return inflight;
  inflight = (async () => {
    const file = join(opts.cacheDir, "content-share-overlay.json");
    const ttl = opts.ttlMs ?? 24 * 60 * 60 * 1000;
    const cached = await readCache(file);
    if (!force && cached && (cached.ageMs ?? 0) < ttl) return cached;
    try {
      const r = await (opts.fetchImpl ?? fetch)(opts.url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const overlay = overlayFromDoc(await r.json());
      await mkdir(opts.cacheDir, { recursive: true });
      await writeFile(file, JSON.stringify({ at: Date.now(), overlay }));
      return { overlay, source: "network", ageMs: 0 };
    } catch {
      return cached || { overlay: {}, source: "none" };
    }
  })();
  try { return await inflight; } finally { inflight = null; }
}

/** Merge an overlay onto the bundled catalog. */
export function applyOverlay(entries: CatalogEntry[], overlay: RemoteOverlay): CatalogEntry[] {
  const byId = new Map(entries.map((e) => [e.id, { ...e }]));
  for (const id of overlay.recommended || []) {
    const e = byId.get(id);
    if (e) e.recommended = true;
  }
  for (const [id, status] of Object.entries(overlay.status || {})) {
    const e = byId.get(id);
    if (e) e.status = status;
  }
  for (const [id, note] of Object.entries(overlay.note || {})) {
    const e = byId.get(id);
    if (e) e.note = note;
  }
  for (const e of overlay.entries || []) if (!byId.has(e.id)) byId.set(e.id, e);
  return Array.from(byId.values());
}
