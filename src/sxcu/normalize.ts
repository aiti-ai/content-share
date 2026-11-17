/** Instantiate a .sxcu config as a ShareProvider. */
import type { MetaField, ProbeResult, ShareProvider, SxcuConfig, TargetConfig } from "../types.ts";
import { configKinds, detectValueFields, executeSxcu } from "./engine.ts";

export interface NormalizeOptions {
  id: string;
  config: SxcuConfig;
  category?: ShareProvider["category"];
  maxBytes?: number;
  probe?: ShareProvider["probe"];
  note?: string;
}

const HOST_LABELS: Record<string, string> = {
  api_key_here: "API key", apikey: "API key", key: "API key", token: "Access token",
  password: "Password", user_hash: "User hash", username: "Username", api_key: "API key",
};

export function normalizeSxcu(opts: NormalizeOptions): ShareProvider {
  const { config, id } = opts;
  const fields = detectValueFields(config);
  const metaFields: MetaField[] = fields.map((key) => ({
    key,
    label: HOST_LABELS[key] || key.replace(/_/g, " "),
    type: /key|token|password|secret/i.test(key) ? "password" : "text",
    required: true,
    hint: config.Name ? `Required by ${config.Name}` : undefined,
  }));
  return {
    id,
    label: config.Name || id,
    kinds: configKinds(config),
    category: opts.category || "publish",
    maxBytes: opts.maxBytes ?? 50 * 1024 * 1024,
    metaFields,
    probe: opts.probe,
    async upload(content, meta, target, hooks) {
      return executeSxcu(config, content, target, meta, hooks);
    },
  };
}

/** Probe a host by GET (any HTTP response means "alive"; 4xx = alive but needs token). */
export function simpleProbe(url: string): ShareProvider["probe"] {
  return async (cfg: TargetConfig): Promise<ProbeResult> => {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return { ok: true, latencyMs: Date.now() - t0, detail: `HTTP ${r.status}${r.status >= 400 ? " (check credentials)" : ""}` };
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
  };
}
