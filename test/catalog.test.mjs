import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Registry } from "../src/registry.ts";
import { aliyunOssProvider, ossAuthorization } from "../src/oss.ts";
import { applyOverlay } from "../src/remote.ts";

const catalog = JSON.parse(await readFile(new URL("../catalog/index.json", import.meta.url), "utf8"));

test("catalog: 161 entries with 8 recommended spanning all kinds", () => {
  assert.ok(catalog.count >= 158, `count=${catalog.count}`);
  const rec = catalog.entries.filter((e) => e.recommended);
  assert.equal(rec.length, 8);
  for (const kind of ["text", "image", "file"]) assert.ok(rec.some((e) => e.kinds.includes(kind)), `missing ${kind}`);
  assert.ok(catalog.entries.some((e) => e.category === "archive" && e.id === "joplin"));
  assert.equal(catalog.entries.find((e) => e.id === "api.anonfiles.com")?.status, "dead");
});

test("registry: init + list + provider lookup", async () => {
  const r = new Registry();
  await r.init();
  assert.ok(r.get("catbox.moe"));
  assert.ok(r.get("joplin"));
  assert.ok(r.get("aliyun-oss"));
  assert.ok(r.list(["image"]).length > 20);
  const publish = r.list().filter((p) => p.category === "publish");
  assert.ok(publish.length > 100);
});

test("overlay: remote recommended/status/note merge", () => {
  const merged = applyOverlay(catalog.entries, {
    recommended: ["pastebin"],
    status: { "catbox.moe": "dead" },
    note: { "catbox.moe": "retired" },
    entries: [{ id: "new-host", name: "New", kinds: ["text"], category: "publish", source: "user", auth: "none" }],
  });
  assert.equal(merged.find((e) => e.id === "pastebin").recommended, true);
  assert.equal(merged.find((e) => e.id === "catbox.moe").status, "dead");
  assert.equal(merged.find((e) => e.id === "catbox.moe").note, "retired");
  assert.ok(merged.find((e) => e.id === "new-host"));
});

test("OSS V1 signature vector", () => {
  const auth = ossAuthorization({
    verb: "PUT", contentMd5: "", contentType: "text/plain",
    date: "Fri, 24 May 2024 10:00:00 GMT",
    canonicalizedHeaders: [], canonicalizedResource: "/bucket/key",
    accessKeyId: "AKID", secret: "SECRET",
  });
  assert.match(auth, /^OSS AKID:/);
  // HMAC-SHA1 of "PUT\n\ntext/plain\nFri, 24 May 2024 10:00:00 GMT\n/bucket/key"
  assert.equal(auth.split(":")[1], "laeKqxCL7TkmPbY4QqBh+RlRD9c=");
});

test("OSS provider: metaFields include bucket/keys", () => {
  const p = aliyunOssProvider();
  assert.deepEqual(p.metaFields.map((f) => f.key).slice(0, 4), ["endpoint", "bucket", "accessKeyId", "accessKeySecret"]);
});
