import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeContainerQuery } from "../src/sxcu/containers.ts";
import { executeSxcu } from "../src/sxcu/engine.ts";
import { normalizeSxcu } from "../src/sxcu/normalize.ts";

/** Tiny mock HTTP server recording requests; handler responds per request. */
async function mockServer(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    await handler(req, res, body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, server, requests,
    // closeAllConnections: keep-alive sockets from fetch must not hold the process open
    // even when an assertion fails before close() is reached.
    close: () => { server.closeAllConnections?.(); return new Promise((r) => server.close(r)); } };
}

const TREE_SPEC = (base) => ({
  field: "parent_id",
  label: { zh: "笔记本", en: "Notebook" },
  listUrl: `${base}/folders?token=<token>&fields=id,parent_id,title&limit=100`,
  itemsPath: "items",
  idField: "id",
  labelField: "title",
  parentField: "parent_id",
  pages: { param: "page", moreField: "has_more" },
});

test("containers: tree mode paginates until has_more=false and builds path labels", async () => {
  const folders = [
    { id: "root1", parent_id: "", title: "My Notebook" },
    { id: "kid1", parent_id: "root1", title: "Work" },
    { id: "kid2", parent_id: "kid1", title: "Deep" },
  ];
  const mock = await mockServer((req, res) => {
    const page = Number(new URL(req.url, "http://x").searchParams.get("page") || 1);
    const token = new URL(req.url, "http://x").searchParams.get("token");
    if (token !== "tk") { res.writeHead(403); return res.end('{"error":"forbidden"}'); }
    res.writeHead(200, { "content-type": "application/json" });
    // Page 1: first two, page 2: the rest (default page size 2 here).
    const slice = page === 1 ? folders.slice(0, 2) : folders.slice(2);
    res.end(JSON.stringify({ items: slice, has_more: page === 1 }));
  });
  const q = makeContainerQuery(TREE_SPEC(mock.base));
  assert.equal(q.field, "parent_id");
  const out = await q.list({ provider: "joplin", values: { token: "tk" } });
  assert.equal(out.length, 3);
  const kid2 = out.find((c) => c.id === "kid2");
  assert.equal(kid2.path, "My Notebook / Work / Deep");
  assert.equal(kid2.parent, "kid1");
  assert.equal(out.find((c) => c.id === "root1").path, "My Notebook");
  assert.ok(!("parent" in out.find((c) => c.id === "root1")));
  // 2 pages fetched via the declared page param
  assert.equal(mock.requests.filter((r) => r.url.includes("page=1")).length, 1);
  assert.equal(mock.requests.filter((r) => r.url.includes("page=2")).length, 1);
  await mock.close();
});

test("containers: tree mode surfaces HTTP errors with status", async () => {
  const mock = await mockServer((_req, res) => { res.writeHead(403); res.end('{"error":"forbidden"}'); });
  const q = makeContainerQuery(TREE_SPEC(mock.base));
  await assert.rejects(() => q.list({ provider: "joplin", values: { token: "bad" } }), /HTTP 403/);
  await mock.close();
});

test("containers: per-parent mode fills {{parent}} (encoded) and applies filter", async () => {
  const mock = await mockServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify([
      { path: "a b/sub", name: "sub", type: "folder" },
      { path: "a b/note.md", name: "note.md", type: "file" },
    ]));
  });
  const q = makeContainerQuery({
    field: "dir",
    listUrl: `${mock.base}/vault/{{parent}}/`,
    idField: "path",
    labelField: "name",
    filter: { type: "folder" },
  });
  const out = await q.list({ provider: "obsidian", values: {} }, "a b");
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a b/sub");
  assert.equal(out[0].label, "sub");
  assert.equal(out[0].parent, "a b");
  assert.ok(mock.requests[0].url.endsWith("/vault/a%20b/"));
  await mock.close();
});

test("containers: itemsPath digs into nested response (siyuan style)", async () => {
  const mock = await mockServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: 0, data: { notebooks: [{ id: "n1", name: "Notes" }] } }));
  });
  const q = makeContainerQuery({
    field: "notebook",
    method: "POST",
    body: "{}",
    listUrl: `${mock.base}/api/notebook/lsNotebooks`,
    itemsPath: "data.notebooks",
    labelField: "name",
  });
  const out = await q.list({ provider: "siyuan", values: {} });
  assert.deepEqual(out, [{ id: "n1", label: "Notes" }]);
  await mock.close();
});

test("engine: container id injects into the declared placeholder; empty = default", async () => {
  const mock = await mockServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "note1" }));
  });
  const config = {
    Name: "Joplin", DestinationType: "TextUploader", RequestMethod: "POST",
    RequestURL: `${mock.base}/notes?token=<token>`, Body: "JSON",
    Data: '{"title":"{{title}}","body":"{{content}}","parent_id":"{{parent_id}}"}',
    URL: "joplin://x-callback-url/openNote?id=$json:id$",
    Container: TREE_SPEC(mock.base),
  };
  const meta = { title: "t1" };
  // With a selected container the id lands in the JSON body.
  await executeSxcu(config, { text: "hello" }, { provider: "joplin", values: { token: "tk" }, container: "root1" }, meta);
  assert.equal(JSON.parse(mock.requests[0].body).parent_id, "root1");
  // Empty container stays an empty string → service default (Joplin accepts "").
  await executeSxcu(config, { text: "hello" }, { provider: "joplin", values: { token: "tk" }, container: "" }, meta);
  assert.equal(JSON.parse(mock.requests[1].body).parent_id, "");
  await mock.close();
});

test("normalize: Container block wires containers capability + upload injection end-to-end", async () => {
  const mock = await mockServer((req, res) => {
    if (req.url.startsWith("/folders")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ items: [{ id: "f1", parent_id: "", title: "Inbox" }], has_more: false }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "created1" }));
  });
  const provider = normalizeSxcu({ id: "joplin", config: { Name: "Joplin", DestinationType: "TextUploader", RequestMethod: "POST", RequestURL: `${mock.base}/notes?token=<token>`, Body: "JSON", Data: '{"title":"{{title}}","body":"{{content}}","parent_id":"{{parent_id}}"}', URL: "joplin://x-callback-url/openNote?id=$json:id$", Container: TREE_SPEC(mock.base) } });
  assert.ok(provider.containers, "containers capability exposed");
  assert.equal(provider.containers.field, "parent_id");
  const list = await provider.containers.list({ provider: "joplin", values: { token: "tk" } });
  assert.equal(list[0].label, "Inbox");
  const result = await provider.upload({ text: "body text" }, { title: "t" }, { provider: "joplin", values: { token: "tk" }, container: "f1" });
  assert.equal(result.url, "joplin://x-callback-url/openNote?id=created1");
  assert.equal(JSON.parse(mock.requests.at(-1).body).parent_id, "f1");
  await mock.close();
});
