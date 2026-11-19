// Pipeline kind guard + engine text→file-style and binary-safe bodies.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { share, contentKindOf } from "../src/pipeline.ts";
import { executeSxcu } from "../src/sxcu/engine.ts";

const textProvider = (kinds = ["text"]) => ({
  id: "fake-text", label: "Fake text", kinds, category: "publish", maxBytes: 1024 * 1024,
  metaFields: [],
  async upload(content) {
    return { url: "https://fake.test/" + ("text" in content ? "t" : "b") };
  },
});

test("contentKindOf: text / image mime / binary buffer", () => {
  assert.equal(contentKindOf({ text: "hi" }), "text");
  assert.equal(contentKindOf({ buffer: new Uint8Array(1), filename: "a.png", mime: "image/png" }), "image");
  assert.equal(contentKindOf({ buffer: new Uint8Array(1), filename: "a.zip", mime: "application/zip" }), "file");
});

test("pipeline: kind mismatch fails fast with a clear error", async () => {
  await assert.rejects(
    () => share(textProvider(["text"]), { buffer: new Uint8Array([1]), filename: "a.png", mime: "image/png" },
      { provider: "fake-text", values: {} }),
    /kind mismatch: fake-text accepts \[text\] but content is image/,
  );
});

test("pipeline: matching kind reaches upload", async () => {
  const r = await share(textProvider(["image"]), { buffer: new Uint8Array([1]), filename: "a.png", mime: "image/png" },
    { provider: "fake-text", values: {} });
  assert.equal(r.url, "https://fake.test/b");
});

/** Mock capturing the raw request body as a Buffer (binary-safe). */
async function bufferServer(handler) {
  const chunks = [];
  const server = http.createServer(async (req, res) => {
    const parts = [];
    for await (const c of req) parts.push(c);
    const body = Buffer.concat(parts);
    chunks.push(body);
    await handler(req, res, body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, last: () => chunks[chunks.length - 1], close: () => new Promise((r) => server.close(r)) };
}

test("engine: text content with explicit FileFormName uploads as a file (ShareX temp-file semantics)", async () => {
  const mock = await bufferServer((_req, res) => { res.writeHead(200); res.end("https://f.test/abc"); });
  try {
    const result = await executeSxcu({
      Name: "FileStyleText", DestinationType: "TextUploader",
      RequestMethod: "POST", RequestURL: `${mock.base}/`,
      Body: "MultipartFormData", FileFormName: "fileToUpload",
      Arguments: { reqtype: "fileupload" },
    }, { text: "binary-ish text\nline2" }, { provider: "x", values: {} });
    assert.equal(result.url, "https://f.test/abc");
    const body = mock.last().toString("latin1");
    assert.ok(body.includes('name="fileToUpload"; filename="share.txt"'), "file part with filename");
    assert.ok(body.includes('Content-Type: text/plain'), "text/plain part mime");
    assert.ok(body.includes("reqtype"), "arguments still present");
    assert.ok(body.includes("line2"), "text content inside the file part");
  } finally { await mock.close(); }
});

test("engine: text content without FileFormName stays a plain field (bpaste style)", async () => {
  const mock = await bufferServer((_req, res) => { res.writeHead(200); res.end("https://p.test/1"); });
  try {
    await executeSxcu({
      Name: "FieldStyle", DestinationType: "TextUploader",
      RequestMethod: "POST", RequestURL: `${mock.base}/`,
      Body: "MultipartFormData", Arguments: { code: "$input$" },
    }, { text: "plain" }, { provider: "x", values: {} });
    const body = mock.last().toString("latin1");
    assert.ok(body.includes('name="code"'), "argument field");
    assert.ok(body.includes('name="file"'), "default file field kept as plain value");
    assert.ok(!body.includes("filename="), "no file part semantics");
  } finally { await mock.close(); }
});

test("engine: Binary body passes bytes through uncorrupted", async () => {
  const mock = await bufferServer((_req, res, body) => {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(body);
  });
  try {
    const bytes = new Uint8Array([0x41, 0x80, 0xfe, 0xff, 0x00, 0x81]);
    const result = await executeSxcu({
      Name: "Bin", DestinationType: "FileUploader",
      RequestMethod: "POST", RequestURL: `${mock.base}/`, Body: "Binary",
      URL: "$response$",
    }, { buffer: bytes, filename: "a.bin", mime: "application/octet-stream" }, { provider: "x", values: {} });
    // $response$ yields the echoed bytes as the "URL" — compare raw request instead:
    assert.deepEqual(Buffer.from(mock.last()), Buffer.from(bytes));
    void result;
  } finally { await mock.close(); }
});

test("engine: empty extracted URL parameter fails instead of returning a dead link", async () => {
  const mock = await bufferServer((_req, res) => { res.writeHead(200); res.end("\nacc89f\n"); });
  try {
    await assert.rejects(
      () => executeSxcu({
        Name: "EmptyParam", DestinationType: "ImageUploader",
        RequestMethod: "POST", RequestURL: `${mock.base}/u`, Body: "MultipartFormData", FileFormName: "f",
        RegexList: ["(.*)\\n(.*)\\n"], URL: "https://e.test/f.php?h=$regex:1|1$",
      }, { buffer: new Uint8Array([1, 2]), filename: "a.png", mime: "image/png" }, { provider: "x", values: {} }),
      /empty URL parameter/,
    );
    // Same shape with a real id still succeeds.
    const s2 = await bufferServer((_req, res) => { res.writeHead(200); res.end("realid\ncode\n"); });
    try {
      const r = await executeSxcu({
        Name: "OkParam", DestinationType: "ImageUploader",
        RequestMethod: "POST", RequestURL: `${s2.base}/u`, Body: "MultipartFormData", FileFormName: "f",
        RegexList: ["(.*)\\n(.*)\\n"], URL: "https://e.test/f.php?h=$regex:1|1$",
      }, { buffer: new Uint8Array([1, 2]), filename: "a.png", mime: "image/png" }, { provider: "x", values: {} });
      assert.equal(r.url, "https://e.test/f.php?h=realid");
    } finally { await s2.close(); }
  } finally { await mock.close(); }
});
