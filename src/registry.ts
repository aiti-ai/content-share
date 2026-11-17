/** Provider registry: bundled catalog + code providers + remote overlay. */
import { readFile } from "node:fs/promises";
import type { CatalogEntry, ShareProvider, SxcuConfig } from "./types.ts";
import { normalizeSxcu } from "./sxcu/normalize.ts";
import { applyOverlay, loadOverlay, type RemoteOptions } from "./remote.ts";
import { aliyunOssProvider } from "./oss.ts";
import { localLinkProvider } from "./local-link.ts";

export interface RegistryOptions extends Partial<RemoteOptions> {
  /** Directory containing catalog/index.json + .sxcu files. Defaults to package catalog/. */
  catalogDir?: string;
}

export class Registry {
  private providers = new Map<string, ShareProvider>();
  private entries: CatalogEntry[] = [];
  private options: RegistryOptions;

  constructor(options: RegistryOptions = {}) {
    this.options = options;
  }

  /** Load the bundled catalog, apply remote overlay, register all providers. */
  async init(forceRefresh = false): Promise<void> {
    const dir = this.options.catalogDir ?? new URL("../catalog/", import.meta.url).pathname;
    const raw = await readFile(`${dir}/index.json`, "utf8");
    const catalog = JSON.parse(raw) as { entries: CatalogEntry[] };
    this.entries = catalog.entries;

    if (this.options.url) {
      const remote = await loadOverlay({
        url: this.options.url,
        cacheDir: this.options.cacheDir ?? `${dir}/.cache`,
        ttlMs: this.options.ttlMs,
        fetchImpl: this.options.fetchImpl,
      }, forceRefresh);
      this.entries = applyOverlay(this.entries, remote.overlay);
    }

    // Code providers first (they override any same-id catalog entry).
    this.register(aliyunOssProvider());
    this.register(localLinkProvider());

    for (const entry of this.entries) {
      if (entry.code || entry.status === "dead" || this.providers.has(entry.id)) continue;
      try {
        const config = entry.sxcu ?? (entry.file
          ? JSON.parse(await readFile(`${dir}/${entry.file}`, "utf8")) as SxcuConfig
          : undefined);
        if (!config) continue;
        this.register(normalizeSxcu({
          id: entry.id, config, category: entry.category,
          ...(entry.note ? { note: entry.note } : {}),
          probe: entry.category === "archive" ? undefined : undefined,
        }));
      } catch { /* skip malformed configs */ }
    }
  }

  register(provider: ShareProvider): void { this.providers.set(provider.id, provider); }
  get(id: string): ShareProvider | undefined { return this.providers.get(id); }
  list(kinds?: ShareProvider["kinds"]): ShareProvider[] {
    const all = Array.from(this.providers.values());
    return kinds?.length ? all.filter((p) => p.kinds.some((k) => kinds.includes(k))) : all;
  }
  catalog(): CatalogEntry[] { return this.entries; }
  addEntry(entry: CatalogEntry, config: SxcuConfig): void {
    this.entries.push(entry);
    this.register(normalizeSxcu({ id: entry.id, config, category: entry.category }));
  }
}
