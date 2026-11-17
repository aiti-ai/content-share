import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { executeSxcu, configKinds, detectValueFields } from "../src/sxcu/engine.ts";
import { share } from "../src/pipeline.ts";
import { normalizeSxcu } from "../src/sxcu/normalize.ts";

/** Tiny mock HTTP server recording the last request. */
async function mockServer(handler) {
  let last = null;
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    last = { method: req.method, url: req.url, headers: req.headers, body };
    await handler(req, res, body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, server, last: () => last, close: () => new Promise((r) => server.close(r)) };
}

test("configKinds: ShareX destination types → content kinds", () => {
  assert.deepEqual(configKinds({ DestinationType: "TextUploader", RequestURL: "x" }), ["text"]);
  assert.deepEqual(configKinds({ DestinationType: "ImageUploader,FileUploader", RequestURL: "x" }), ["image", "file"]);
});

test("detectValueFields: placeholder tokens", () => {
  const fields = detectValueFields({
    RequestURL: "https://x/?key=<API KEY HERE>",
    Headers: { Authorization: "Bearer <token>" },
  });
  assert.ok(fields.includes("api_key_here"));
  assert.ok(fields.includes("token"));
});

test("engine: JSON body + $json: URL extraction + redaction hook", async () => {
  const mock = await mockServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, url: "https://paste.test/xyz", delete: "https://paste.test/rm/xyz" }));
  });
  try {
    const provider = normalizeSxcu({
      id: "json-test",
      config: {
        Name: "JSON Test", DestinationType: "TextUploader",
        RequestMethod: "POST", RequestURL: `${mock.base}/api`, Body: "JSON",
        Data: '{"title":"{{title}}","tags":"{{tags}}","content":"{{content}}"}',
        Headers: { "Content-Type": "application/json" },
        URL: "$json:url$", DeletionURL: "$json:delete$",
      },
    });
    const result = await share(provider, { text: "hello {world} \"quoted\"" },
      { provider: "json-test", values: {}, tags: "a,b" },
      { title: "T", tags: "a,b" },
      { transformText: (t) => ({ text: t.replace("hello", "[REDACTED]"), hits: [{ rule: "test", count: 1 }] }) });
    assert.equal(result.url, "https://paste.test/xyz");
    assert.equal(result.extra.deletionUrl, "https://paste.test/rm/xyz");
    assert.equal(result.hits[0].count, 1);
    const sent = JSON.parse(mock.last().body);
    assert.ok(sent.content.includes('[REDACTED] {world} "quoted"')); // braces/quotes survive parsing; front-matter prepended
    assert.ok(sent.content.startsWith("---\ntitle: T")); // tags/title front-matter
    assert.equal(sent.title, "T");
  } finally { await mock.close(); }
});

test("engine: multipart file upload + FileFormName", async () => {
  const mock = await mockServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("https://img.test/a.png\n");
  });
  try {
    const result = await executeSxcu({
      Name: "Img", DestinationType: "ImageUploader", RequestMethod: "POST",
      RequestURL: `${mock.base}/upload`, Body: "MultipartFormData", FileFormName: "fileToUpload",
      Arguments: { reqtype: "fileupload" },
    }, { buffer: new TextEncoder().encode("PNGDATA"), filename: "a.png", mime: "image/png" },
    { provider: "img", values: {} });
    assert.equal(result.url, "https://img.test/a.png");
    assert.ok(mock.last().body.includes("fileToUpload"));
    assert.ok(mock.last().body.includes("reqtype"));
  } finally { await mock.close(); }
});

test("engine: FormURLEncoded + regex extraction", async () => {
  const mock = await mockServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("OK https://pastebin.com/aBc123 done");
  });
  try {
    const result = await executeSxcu({
      Name: "PB", DestinationType: "TextUploader", RequestMethod: "POST",
      RequestURL: `${mock.base}/api`, Body: "FormURLEncoded", FileFormName: "api_paste_code",
      Arguments: { api_option: "paste" }, URL: "$regex:1$", RegexList: ["(https?://pastebin\\.com/\\w+)"],
    }, { text: "code" }, { provider: "pb", values: {} });
    assert.equal(result.url, "https://pastebin.com/aBc123");
    assert.ok(mock.last().body.includes("api_paste_code=code"));
  } finally { await mock.close(); }
});

test("engine: Binary body + literal URL from response", async () => {
  const mock = await mockServer((_req, res) => {
    res.writeHead(200).end("https://bin.test/xyz\n");
  });
  try {
    const result = await executeSxcu({
      Name: "Bin", DestinationType: "TextUploader", RequestMethod: "POST",
      RequestURL: `${mock.base}/`, Body: "Binary",
    }, { text: "hello" }, { provider: "bin", values: {} });
    assert.equal(result.url, "https://bin.test/xyz");
    assert.equal(mock.last().body, "hello");
  } finally { await mock.close(); }
});

test("pipeline: maxBytes guard", async () => {
  const provider = normalizeSxcu({ id: "small", config: { RequestURL: "https://x.test", DestinationType: "TextUploader" }, maxBytes: 5 });
  await assert.rejects(() => share(provider, { text: "too long" }, { provider: "small", values: {} }), /too large/);
});
