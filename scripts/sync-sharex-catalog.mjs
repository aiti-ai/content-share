/**
 * Sync the full ShareX CustomUploaders catalog into ./catalog/sharex.
 * Source: https://github.com/ShareX/CustomUploaders (public .sxcu configs).
 * Run: node scripts/sync-sharex-catalog.mjs
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const API = "https://api.github.com/repos/ShareX/CustomUploaders/git/trees/master";
const RAW = "https://raw.githubusercontent.com/ShareX/CustomUploaders/master/";
const DIR = new URL("../catalog/sharex/", import.meta.url);

const ghHeaders = { "user-agent": "aiti-content-share-catalog-sync" };
if (process.env.GITHUB_TOKEN) ghHeaders.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const tree = await fetch(API, { headers: ghHeaders }).then((r) => r.json());
if (!tree.tree) throw new Error(`GitHub tree fetch failed: ${tree.message || "unknown"}`);
const files = tree.tree.filter((f) => f.path.endsWith(".sxcu"));
await mkdir(DIR, { recursive: true });

let added = 0;
const queue = [...files];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const f = queue.shift();
    if (!f) break;
    const dest = join(DIR.pathname, f.path);
    let current = "";
    try { current = await readFile(dest, "utf8"); } catch {}
    const res = await fetch(RAW + encodeURIComponent(f.path), { headers: ghHeaders });
    if (!res.ok) { console.error(`skip ${f.path}: HTTP ${res.status}`); continue; }
    const body = await res.text();
    try { JSON.parse(body); } catch { console.error(`skip ${f.path}: invalid json`); continue; }
    if (body !== current) { await writeFile(dest, body); added++; }
  }
}));

// Prune files removed upstream
const upstream = new Set(files.map((f) => f.path));
for (const name of await readdir(DIR)) if (name.endsWith(".sxcu") && !upstream.has(name)) {
  const { unlink } = await import("node:fs/promises");
  await unlink(join(DIR.pathname, name));
}
console.log(`catalog sync: ${files.length} .sxcu upstream, ${added} written/updated`);
