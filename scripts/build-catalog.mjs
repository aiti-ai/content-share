/**
 * Build catalog/index.json from all .sxcu files + a metadata overlay.
 * Run: node scripts/build-catalog.mjs
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../catalog/", import.meta.url);
const metaPath = new URL("./metadata.json", root);
let meta = {};
try { meta = JSON.parse(await readFile(metaPath, "utf8")); } catch {}

const mapKinds = (raw = "") => {
  const m = { ImageUploader: "image", TextUploader: "text", FileUploader: "file", FileSharer: "file", URLShortener: "text", URLSharingService: "text" };
  return [...new Set(String(raw).split(",").map((s) => m[s.trim()]).filter(Boolean))];
};

const entries = [];
for (const [dir, source] of [["sharex", "sharex"], ["aiti", "aiti"]]) {
  const files = await readdir(new URL(`./${dir}/`, root));
  for (const file of files.filter((f) => f.endsWith(".sxcu"))) {
    let config;
    try { config = JSON.parse(await readFile(new URL(`./${dir}/${file}`, root), "utf8")); } catch { continue; }
    const id = file.replace(/\.sxcu$/, "");
    const override = meta[id] || {};
    const hasAuth = /<(token|key|api|password|secret|hash)/i.test(JSON.stringify(config));
    entries.push({
      id,
      name: config.Name || override.name || id,
      kinds: mapKinds(config.DestinationType).length ? mapKinds(config.DestinationType) : ["text"],
      category: override.category || "publish",
      source,
      auth: hasAuth ? (override.auth || "token") : "none",
      recommended: !!override.recommended,
      note: override.note || "",
      status: override.status || "ok",
      file: `${dir}/${file}`,
    });
  }
}
// Code providers (not .sxcu files) — registered by the runtime registry.
for (const id of ["local-link", "aliyun-oss"]) {
  const o = meta[id] || {};
  entries.push({
    id, name: o.name || id, kinds: ["text", "image", "file"],
    category: o.category || "publish", source: "aiti", auth: "key",
    recommended: !!o.recommended, note: o.note || "", status: "ok", code: true,
  });
}
entries.sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended) || a.name.localeCompare(b.name));
const out = { version: 1, generatedAt: new Date().toISOString(), count: entries.length, entries };
await writeFile(new URL("./index.json", root), JSON.stringify(out, null, 2) + "\n");
console.log(`catalog built: ${entries.length} entries (${entries.filter((e) => e.recommended).length} recommended)`);
