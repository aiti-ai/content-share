#!/usr/bin/env node
/**
 * Minimal self-hosted paste server — reference implementation for the
 * aiti-msg-share `custom-http` provider.
 *
 * Zero dependencies, single file. Demonstrates the provider contract:
 *   - json bodyType, template variables {{title}}/{{tags}}/{{content}}/{{filename}}
 *   - response URL extraction (urlExtract: "url")
 *
 * Run:        node custom-paste-server.mjs [port]        # default 8931
 * Target cfg: url         http://127.0.0.1:8931/api/pastes
 *             method      POST
 *             bodyType    json
 *             bodyTemplate {"title":"{{title}}","tags":"{{tags}}","content":"{{content}}"}
 *             urlExtract  url
 *
 * Endpoints:
 *   POST   /api/pastes        {title, tags, content, filename?} → 201 {ok,url,rawUrl,id,deleteToken}
 *   GET    /p/<id>            HTML render page
 *   GET    /raw/<id>          raw text
 *   DELETE /api/pastes/<id>?token=<deleteToken>
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.argv[2] || 8931);
const MAX_BODY = 8 * 1024 * 1024; // 8MB, matches a typical provider maxBytes
const STORE = new Map(); // id → {title, tags, content, filename, createdAt, deleteToken}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const json = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  // POST /api/pastes — the endpoint the custom-http provider template points at
  if (req.method === "POST" && url.pathname === "/api/pastes") {
    let body = "";
    let over = false;
    req.on("data", (c) => { body += c; if (body.length > MAX_BODY) { over = true; req.destroy(); } });
    req.on("end", () => {
      if (over) return;
      let p;
      try { p = JSON.parse(body || "{}"); } catch { return json(res, 400, { ok: false, error: "invalid json" }); }
      const content = String(p.content ?? "");
      if (!content.trim()) return json(res, 400, { ok: false, error: "content is empty" });
      const id = crypto.randomBytes(4).toString("hex");
      const deleteToken = crypto.randomBytes(8).toString("hex");
      STORE.set(id, {
        title: String(p.title ?? "untitled"),
        tags: String(p.tags ?? ""),
        content,
        filename: p.filename ? String(p.filename) : null,
        createdAt: new Date().toISOString(),
        deleteToken,
      });
      const base = `${url.protocol}//${req.headers.host}`;
      json(res, 201, { ok: true, id, url: `${base}/p/${id}`, rawUrl: `${base}/raw/${id}`, deleteToken });
    });
    return;
  }

  // GET /p/<id> — HTML render
  if (req.method === "GET" && parts[0] === "p" && parts[1]) {
    const item = STORE.get(parts[1]);
    if (!item) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(item.title)}</title>
<style>body{font:14px/1.6 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px}
pre{background:#f6f6f6;padding:12px;border-radius:8px;overflow:auto;white-space:pre-wrap}
.tag{display:inline-block;background:#eef;padding:1px 8px;border-radius:10px;margin-right:6px;font-size:12px}
.meta{color:#888;font-size:12px;margin-bottom:12px}</style></head><body>
<h2>${esc(item.title)}</h2>
<div class="meta">${esc(item.createdAt)}${item.filename ? " · " + esc(item.filename) : ""}</div>
<div>${esc(item.tags).split(",").filter(Boolean).map((t) => `<span class="tag">${esc(t.trim())}</span>`).join("")}</div>
<pre>${esc(item.content)}</pre></body></html>`);
  }

  // GET /raw/<id> — raw text
  if (req.method === "GET" && parts[0] === "raw" && parts[1]) {
    const item = STORE.get(parts[1]);
    if (!item) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    return res.end(item.content);
  }

  // DELETE /api/pastes/<id>?token=
  if (req.method === "DELETE" && parts[0] === "api" && parts[1] === "pastes" && parts[2]) {
    const item = STORE.get(parts[2]);
    if (!item || url.searchParams.get("token") !== item.deleteToken) return json(res, 404, { ok: false });
    STORE.delete(parts[2]);
    return json(res, 200, { ok: true });
  }

  // GET / — tiny landing page (also serves as a reachability probe)
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>aiti-msg-share demo paste</title></head>
<body><h2>aiti-msg-share demo paste server</h2><p>${STORE.size} pastes in memory. POST /api/pastes</p></body></html>`);
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => console.log(`[paste-demo] listening on http://127.0.0.1:${PORT}`));
