/**
 * .sxcu execution engine: build an HTTP request from a config, send it,
 * extract the resulting URL via ShareX syntax. Zero dependencies.
 */
import type { SxcuConfig, ShareContent, ShareResult, TargetConfig, ShareHooks, ContentKind } from "../types.ts";
import { applySyntax, type SyntaxContext } from "./syntax.ts";

const MAX_RESPONSE = 4 * 1024 * 1024;

export function configKinds(config: SxcuConfig): ContentKind[] {
  const raw = (config.DestinationType || "TextUploader").split(",");
  const map: Record<string, ContentKind> = {
    ImageUploader: "image", TextUploader: "text", FileUploader: "file",
    FileSharer: "file", URLShortener: "text", URLSharingService: "text",
  };
  const kinds = raw.map((s) => map[s.trim()]).filter((k): k is ContentKind => !!k);
  return Array.from(new Set(kinds.length ? kinds : ["text"]));
}

/** Placeholder detection: any `<...>` token in URL/Arguments/Data → user-supplied field. */
export function detectValueFields(config: SxcuConfig): string[] {
  const fields = new Set<string>();
  const scan = (text: string | undefined) => {
    for (const m of String(text || "").matchAll(/<([A-Za-z0-9 _.\-]+)>/g)) {
      const name = m[1]!.trim();
      // Any <placeholder> in a request template must be filled by the user —
      // otherwise the literal text would be sent (e.g. flomo's <webhook_id>).
      // Keep filtering out obvious prose placeholders that are not field names.
      if (!name || /^https?$/i.test(name)) continue;
      fields.add(name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  };
  scan(config.RequestURL); scan(config.Data);
  Object.values(config.Parameters || {}).forEach(scan);
  Object.values(config.Headers || {}).forEach(scan);
  Object.values(config.Arguments || {}).forEach(scan);
  return Array.from(fields).filter(Boolean);
}

function contentText(content: ShareContent, hooks?: ShareHooks, meta?: Record<string, string>): string {
  if ("text" in content) {
    const t = hooks?.transformText ? hooks.transformText(content.text).text : content.text;
    const front = meta?.title || meta?.tags
      ? `---\n${meta.title ? `title: ${meta.title}\n` : ""}${meta.tags ? `tags: [${meta.tags}]\n` : ""}---\n\n`
      : "";
    return front + t;
  }
  return new TextDecoder().decode(content.buffer);
}

function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/<([A-Za-z0-9 _.\-]+)>/g, (m, raw: string) => {
    const key = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    return values[key] ?? values[raw.trim()] ?? m;
  });
}

export interface EngineOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Execute one .sxcu config.
 * Works for text (raw body), image/file (multipart with FileFormName).
 */
export async function executeSxcu(
  config: SxcuConfig,
  content: ShareContent,
  target: TargetConfig,
  meta: Record<string, string> = {},
  hooks?: ShareHooks,
  options: EngineOptions = {},
): Promise<ShareResult> {
  const fetchFn = options.fetchImpl ?? fetch;
  const text = contentText(content, hooks, meta);
  const filename = "filename" in content ? content.filename : (content.filename || "share.txt");
  const values = { ...target.values, ...meta };

  const ctxBase: SyntaxContext = {
    input: text, filename, values, tags: meta.tags || target.tags,
    regexList: config.RegexList || [],
  } as SyntaxContext;

  // Double-brace variables ({{content}}/{{title}}/{{filename}}/...) are a
  // convenience extension used by the built-in native configs. Resolve them
  // before ShareX syntax so JSON bodies stay correctly escaped below.
  const fill = (s: string | undefined) => {
    // Protect double-brace variables from the ShareX syntax parser with
    // sentinels, then substitute the raw values afterwards. This prevents
    // braces inside shared content from being re-parsed as functions.
    const held: string[] = [];
    let out = (s || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
      const k = key.toLowerCase();
      const value = k === "content" || k === "text" || k === "input" ? text
        : k === "filename" ? filename
        : k === "tags" ? (meta.tags || target.tags || "")
        : (values[key] ?? "");
      held.push(value ?? "");
      return `\u0000${held.length - 1}\u0000`;
    });
    out = fillPlaceholders(applySyntax(out, ctxBase), values);
    return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => held[Number(i)] ?? "");
  };
  let url = fill(config.RequestURL);
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(config.Parameters || {})) query.set(k, fill(v));
  if (query.size) url += (url.includes("?") ? "&" : "?") + query.toString();

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.Headers || {})) headers[k] = fill(v);

  const bodyType = config.Body || "MultipartFormData";
  const init: RequestInit = { method: config.RequestMethod?.toUpperCase() || "POST", headers };

  if (bodyType === "MultipartFormData") {
    const form = new FormData();
    for (const [k, v] of Object.entries(config.Arguments || {})) form.set(k, fill(v));
    if ("buffer" in content) {
      form.set(config.FileFormName || "file", new Blob([new Uint8Array(content.buffer)], { type: content.mime }), filename);
      ctxBase.input = new TextDecoder().decode(content.buffer);
    } else {
      form.set(config.FileFormName || "file", text);
    }
    init.body = form;
  } else if (bodyType === "FormURLEncoded") {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(config.Arguments || {})) form.set(k, fill(v));
    form.set(config.FileFormName || "content", text);
    headers["content-type"] = "application/x-www-form-urlencoded";
    init.body = form.toString();
  } else if (bodyType === "JSON" || bodyType === "XML") {
    let raw: string;
    const data = config.Data?.trim();
    if (data && data.startsWith("{")) {
      // JSON-aware substitution: parse first, fill string leaves, then stringify.
      // This keeps quotes/newlines in shared content properly escaped.
      try {
        const tree: unknown = JSON.parse(data);
        const walk = (v: unknown): unknown => {
          if (typeof v === "string") return fill(v);
          if (Array.isArray(v)) return v.map(walk);
          if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
          return v;
        };
        raw = JSON.stringify(walk(tree));
      } catch { raw = fill(data); }
    } else {
      raw = data ? fill(data) : JSON.stringify({ ...Object.fromEntries(Object.entries(config.Arguments || {}).map(([k, v]) => [k, fill(v)])), content: text });
    }
    headers["content-type"] = bodyType === "JSON" ? "application/json" : "application/xml";
    init.body = raw;
  } else {
    init.body = "text" in content ? text : Buffer.from(content.buffer).toString("binary");
  }

  const response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(options.timeoutMs ?? 30000) });
  const responseText = (await response.text()).slice(0, MAX_RESPONSE);
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((v, k) => { responseHeaders[k] = v; });

  if (!response.ok) {
    const detail = applySyntax(config.ErrorMessage, { ...ctxBase, response: responseText, headers: responseHeaders })
      || responseText.slice(0, 200) || `HTTP ${response.status}`;
    throw new Error(`[${config.Name || "sxcu"}] ${response.status}: ${detail}`);
  }

  const ctx: SyntaxContext = {
    ...ctxBase, response: responseText, headers: responseHeaders, url: response.url || url,
    regexList: config.RegexList || [],
  } as SyntaxContext;
  const urlOut = applySyntax(config.URL, ctx).trim();
  if (!urlOut) {
    // Configs without URL field return the raw response (catbox/0x0 style).
    const candidate = responseText.trim().split(/\s+/)[0] || "";
    if (!/^https?:\/\//i.test(candidate)) throw new Error(`[${config.Name || "sxcu"}] no URL in response`);
    return { url: candidate };
  }
  const result: ShareResult = { url: urlOut };
  const del = applySyntax(config.DeletionURL, ctx).trim();
  const thumb = applySyntax(config.ThumbnailURL, ctx).trim();
  if (del || thumb || response.ok) {
    result.extra = {
      ...(del ? { deletionUrl: del } : {}),
      ...(thumb ? { thumbnailUrl: thumb } : {}),
    };
  }
  return result;
}
