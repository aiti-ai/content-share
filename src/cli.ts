#!/usr/bin/env node
/** CLI for @aiti-ai/content-share. Scope: providers, upload, catalog, mocks. */
import { readFile } from "node:fs/promises";
import { Registry } from "./registry.ts";
import { share } from "./pipeline.ts";
import { customProvider } from "./custom.ts";

const args = process.argv.slice(2);
const cmd = args[0] || "help";

async function registry(): Promise<Registry> {
  const r = new Registry();
  await r.init();
  r.register(customProvider());
  return r;
}

if (cmd === "list") {
  const r = await registry();
  const kind = args[1];
  const entries = r.catalog().filter((e) => !kind || e.kinds.includes(kind as never));
  console.log(`${entries.length} providers${kind ? ` (${kind})` : ""}:`);
  for (const e of entries) {
    const flags = [e.recommended ? "★recommended" : "", e.status && e.status !== "ok" ? e.status : "", e.auth !== "none" ? e.auth : ""].filter(Boolean).join(" ");
    console.log(`  ${e.id.padEnd(36)} ${e.kinds.join("/").padEnd(16)} ${e.category.padEnd(9)} ${flags}`);
  }
} else if (cmd === "share") {
  const flags = new Map<string, string>();
  for (let i = 1; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      const value = next && !next.startsWith("--") ? (i++, next) : "true";
      flags.set(key, value);
    }
  }
  const providerId = flags.get("provider") || "custom";
  const r = await registry();
  const provider = r.get(providerId);
  if (!provider) { console.error(`unknown provider: ${providerId}`); process.exit(1); }
  const filePath = flags.get("file");
  const text = filePath ? await readFile(filePath, "utf8") : (flags.get("text") || await readFile("/dev/stdin", "utf8").catch(() => ""));
  const values: Record<string, string> = {};
  for (const [k, v] of flags) if (!["provider", "file", "text", "title", "tags"].includes(k)) values[k] = v;
  const result = await share(provider, { text }, { provider: providerId, values, tags: flags.get("tags") },
    { title: flags.get("title") || "", tags: flags.get("tags") || "" });
  console.log(result.url);
  if (result.extra?.deletionUrl) console.log(`delete: ${result.extra.deletionUrl}`);
} else {
  console.log(`@aiti-ai/content-share
Usage:
  content-share list [text|image|file]      List providers
  content-share share --provider <id> [--file f | --text t] [--title T] [--tags a,b] [--<field> value...]
  content-share help                        This help
`);
}
