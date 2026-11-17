/**
 * ShareX custom uploader syntax parser.
 *
 * Spec source: ShareX/ShareX ShareX.UploadersLib/CustomUploader/
 *   ShareXSyntaxParser.cs + CustomUploader/Functions/*.cs (GPL v3).
 * Ported semantics (not source) with zero dependencies.
 *
 * Runtime syntax: {json:path}, {regex:1}, {header:name}, ...
 * Legacy .sxcu syntax: $json:path$ — migrated to braces before parsing.
 * Escapes: \{ \} \| \\ produce literal characters.
 */

export interface SyntaxContext {
  response?: string;
  headers?: Record<string, string>;
  input?: string;
  filename?: string;
  values?: Record<string, string>;
  tags?: string;
  url?: string;
}

/** Migrate `$json:path$` → `{json:path}` (ShareX CustomUploaderItem.MigrateOldSyntax). */
export function migrateOldSyntax(text: string | undefined): string {
  if (!text) return "";
  let out = "";
  let open = true;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "$") { out += open ? "{" : "}"; open = !open; continue; }
    if (c === "\\") { if (i + 1 < text.length) out += text[++i]; continue; }
    if (c === "{" || c === "}") { out += "\\" + c; continue; }
    out += c;
  }
  return out;
}

function jsonPath(value: unknown, path: string): string {
  if (!path || path === "$" || path === "{response}") return typeof value === "string" ? value : JSON.stringify(value);
  const segments = path.replace(/^\$\.?/, "").replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur: unknown = value;
  for (const seg of segments) {
    if (cur == null) return "";
    if (Array.isArray(cur)) cur = cur[Number(seg)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[seg];
    else return "";
  }
  if (cur == null) return "";
  return typeof cur === "string" ? cur : JSON.stringify(cur);
}

function callFunction(name: string, params: string[], ctx: SyntaxContext): string {
  const p = (i: number) => params[i] ?? "";
  switch (name.toLowerCase()) {
    case "json": {
      let raw: unknown;
      let path: string;
      if (params.length > 1) { raw = safeJson(p(0)); path = p(1); }
      else { raw = safeJson(ctx.response ?? ""); path = p(0); }
      return jsonPath(raw, path);
    }
    case "regex": {
      const idx = Number(p(0) || "1");
      // ShareX RegexList[N] where 1 = first match, 0 = whole input
      const list = ctx as SyntaxContext & { regexList?: string[] };
      const pattern = list.regexList?.[idx - 1];
      if (!pattern) return "";
      try {
        const m = new RegExp(pattern).exec(ctx.response ?? "");
        return m ? (m[1] ?? m[0]) : "";
      } catch { return ""; }
    }
    case "base64": return Buffer.from(p(0), "utf8").toString("base64");
    case "header": {
      const key = p(0).toLowerCase();
      const headers = ctx.headers ?? {};
      return headers[key] ?? Object.entries(headers).find(([k]) => k.toLowerCase() === key)?.[1] ?? "";
    }
    case "responseurl": return ctx.url ?? ctx.response ?? "";
    case "response": return ctx.response ?? "";
    case "input": return ctx.input ?? "";
    case "filename": return ctx.filename ?? "";
    case "title": return ctx.values?.title ?? "";
    case "tags": return ctx.tags ?? ctx.values?.tags ?? "";
    case "random": {
      const len = Math.min(64, Math.max(1, Number(p(0) || "6")));
      return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(len)))
        .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
    }
    case "urlencode": return encodeURIComponent(p(0));
    case "xmlescape": return p(0).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
    case "select": {
      // {select:key|value|default}: value lookup in values map
      const key = p(0); const def = p(2);
      return ctx.values?.[key] || def;
    }
    default: return ""; // unknown ShareX functions degrade to empty (same as ShareX when not applicable)
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

/**
 * Recursive-descent parser matching ShareXSyntaxParser.Parse semantics.
 * `{` starts a function, `:` starts parameters, `|` separates parameters,
 * `}` closes, `\` escapes the next char.
 */
export function parseSyntax(text: string, ctx: SyntaxContext): string {
  let pos = 0;
  function parse(isFunction: boolean): { value: string; end: number } {
    let out = "";
    let escape = false;
    while (pos < text.length) {
      const c = text[pos]!;
      if (!escape) {
        if (c === "{") {
          pos++;
          const inner = parse(true);
          out += inner.value;
          // inner.end points at the closing '}' (or '|' separator); skip it.
          pos = inner.end + 1;
          continue;
        }
        if (c === "}" || c === "|") break;
        if (c === ":" && isFunction) {
          const params: string[] = [];
          do {
            pos++;
            params.push(parse(false).value);
          } while (text[pos] === "|");
          return { value: callFunction(out, params, ctx), end: pos };
        }
        if (c === "\\") {
          escape = true;
          pos++;
          continue;
        }
      }
      escape = false;
      out += c;
      pos++;
    }
    return { value: isFunction ? callFunction(out, [], ctx) : out, end: pos };
  }
  return parse(false).value;
}

/** Apply both syntaxes to a config string with the response context. */
export function applySyntax(text: string | undefined, ctx: SyntaxContext): string {
  if (!text) return "";
  return parseSyntax(migrateOldSyntax(text), ctx);
}
