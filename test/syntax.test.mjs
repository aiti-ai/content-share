import test from "node:test";
import assert from "node:assert/strict";
import { migrateOldSyntax, parseSyntax, applySyntax } from "../src/sxcu/syntax.ts";

test("migrateOldSyntax: legacy $json:path$ → {json:path}", () => {
  assert.equal(migrateOldSyntax("$json:data.url$"), "{json:data.url}");
  assert.equal(migrateOldSyntax("joplin://open?id=$json:id$"), "joplin://open?id={json:id}");
  assert.equal(migrateOldSyntax("\\$literal\\$"), "$literal$");
});

test("parseSyntax: json path, regex, base64, nested response", () => {
  const ctx = { response: JSON.stringify({ data: { url: "https://x.test/abc" }, files: [{ url: "u" }] }) };
  assert.equal(parseSyntax("{json:data.url}", ctx), "https://x.test/abc");
  assert.equal(parseSyntax("$json:data.url$", ctx), "$json:data.url$"); // legacy syntax needs applySyntax migration
  assert.equal(applySyntax("$json:data.url$", ctx), "https://x.test/abc");
  assert.equal(parseSyntax("{json:files[0].url}", ctx), "u");
  assert.equal(parseSyntax("{base64:hi}", ctx), "aGk=");
  assert.equal(parseSyntax("{json:{response}|data.url}", ctx), "https://x.test/abc");
});

test("parseSyntax: escapes, values and tags", () => {
  assert.equal(parseSyntax("\\{not-a-function\\}", {}), "{not-a-function}");
  assert.equal(parseSyntax("{title}", { values: { title: "T" } }), "T");
  assert.equal(parseSyntax("{tags}", { tags: "a,b" }), "a,b");
  assert.equal(parseSyntax("{unknown}", {}), "");
});

test("parseSyntax: regex uses RegexList[1] match group", () => {
  const ctx = { response: "See https://paste.rs/abc123 now", regexList: ["(https?://paste\\.rs/\\w+)"] };
  assert.equal(parseSyntax("{regex:1}", ctx), "https://paste.rs/abc123");
});
