// Remote overlay: bilingual notes, audit-doc format, labels passthrough.
import test from "node:test";
import assert from "node:assert/strict";
import { applyOverlay, overlayFromDoc } from "../src/remote.ts";

const base = [
  { id: "paste.rs", name: "paste.rs", kinds: ["text"], category: "publish", source: "aiti", auth: "none", note: "" },
  { id: "bakka.me", name: "bakka.me", kinds: ["text"], category: "publish", source: "sharex", auth: "none" },
  { id: "gitee-gist", name: "Gitee Snippet", kinds: ["text"], category: "publish", source: "aiti", auth: "token" },
];

test("overlay: bilingual note object passes through applyOverlay", () => {
  const merged = applyOverlay(base, {
    note: { "paste.rs": { zh: "匿名文本粘贴", en: "Anonymous text paste" } },
    status: { "bakka.me": "dead" },
  });
  assert.equal(merged[0].note.zh, "匿名文本粘贴");
  assert.equal(merged[0].note.en, "Anonymous text paste");
  assert.equal(merged[1].status, "dead");
});

test("overlay: audit doc (providers/setupProviders/labels) normalizes to overlay", () => {
  const doc = {
    providers: [
      { id: "paste.rs", verdict: "cn-ok", note: { zh: "国内直连可用", en: "China direct OK" } },
      { id: "bakka.me", verdict: "dead", note: { zh: "服务已死", en: "Dead" } },
      { id: "ttm.sh (File uploader)", verdict: "vpn-unreachable", note: { zh: "疑似已死", en: "presumed offline" } },
    ],
    setupProviders: [
      { id: "gitee-gist", note: { zh: "需注册获取 token", en: "token required" } },
    ],
    labels: { verdicts: { "cn-ok": { zh: "国内可用", en: "China direct OK" } } },
  };
  const overlay = overlayFromDoc(doc);
  assert.equal(overlay.status["bakka.me"], "dead");
  assert.equal(overlay.status["ttm.sh (File uploader)"], "dead");
  assert.equal(overlay.status["paste.rs"], undefined);
  assert.equal(overlay.note["gitee-gist"].en, "token required");
  assert.ok(overlay.labels.verdicts);

  const merged = applyOverlay(base, overlay);
  assert.equal(merged[1].status, "dead");
  assert.equal(merged[2].note.zh, "需注册获取 token");
});

test("overlay: classic shape is returned as-is", () => {
  const classic = { recommended: ["paste.rs"], status: { "bakka.me": "dead" }, note: { "paste.rs": "plain" } };
  const overlay = overlayFromDoc(classic);
  assert.equal(overlay.recommended[0], "paste.rs");
  assert.equal(overlay.note["paste.rs"], "plain");
});
