/**
 * Alibaba Cloud OSS provider — V1 signature (HMAC-SHA1 over the canonical
 * request) via native fetch + node:crypto. Static .sxcu headers cannot express
 * a per-request signature, so this one stays in code.
 *
 * Docs: https://help.aliyun.com/document_detail/31978.html
 */
import { createHmac } from "node:crypto";
import type { MetaField, ShareContent, ShareProvider, ShareResult, TargetConfig } from "./types.ts";

const metaFields: MetaField[] = [
  { key: "endpoint", label: "Endpoint (e.g. oss-cn-hangzhou.aliyuncs.com)", type: "text", required: true },
  { key: "bucket", label: "Bucket", type: "text", required: true },
  { key: "accessKeyId", label: "AccessKey ID", type: "text", required: true },
  { key: "accessKeySecret", label: "AccessKey Secret", type: "password", required: true },
  { key: "publicBaseUrl", label: "Public base URL (CDN/bucket domain)", type: "text", required: false, hint: "Defaults to https://{bucket}.{endpoint}" },
];

function hmacSha1(key: string, text: string): string {
  return createHmac("sha1", key).update(text).digest("base64");
}

/** Exported for fixed-vector tests. */
export function ossAuthorization(params: {
  verb: string; contentMd5: string; contentType: string; date: string;
  canonicalizedHeaders: Array<[string, string]>; canonicalizedResource: string;
  accessKeyId: string; secret: string;
}): string {
  const canonHeaders = params.canonicalizedHeaders
    .slice().sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}\n`).join("");
  const stringToSign = [
    params.verb, params.contentMd5, params.contentType, params.date,
    canonHeaders + params.canonicalizedResource,
  ].join("\n");
  return `OSS ${params.accessKeyId}:${hmacSha1(params.secret, stringToSign)}`;
}

function objectKey(target: TargetConfig, filename: string): string {
  const prefix = (target.pathPrefix || "").replace(/^\/+|\/+$/g, "");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix ? prefix + "/" : ""}${date}/${Date.now()}-${filename}`;
}

export function aliyunOssProvider(): ShareProvider {
  return {
    id: "aliyun-oss",
    label: "Alibaba Cloud OSS",
    kinds: ["text", "image", "file"],
    category: "publish",
    maxBytes: 500 * 1024 * 1024,
    metaFields,
    async probe(cfg) {
      const { bucket, endpoint } = cfg.values;
      if (!bucket || !endpoint) return { ok: false, detail: "bucket and endpoint required" };
      const t0 = Date.now();
      try {
        const r = await fetch(`https://${bucket}.${endpoint}/`, { signal: AbortSignal.timeout(6000) });
        return { ok: true, latencyMs: Date.now() - t0, detail: `HTTP ${r.status}` };
      } catch (e) { return { ok: false, detail: (e as Error).message }; }
    },
    async upload(content, meta, cfg, hooks) {
      const { endpoint, bucket, accessKeyId, accessKeySecret, publicBaseUrl } = cfg.values;
      if (!endpoint || !bucket || !accessKeyId || !accessKeySecret) throw new Error("OSS target incomplete");
      const filename = "filename" in content ? content.filename : (content.filename || "share.md");
      const body = "text" in content
        ? new TextEncoder().encode(hooks?.transformText ? hooks.transformText(content.text).text : content.text)
        : content.buffer;
      const mime = "mime" in content ? content.mime : "text/markdown; charset=utf-8";
      const key = objectKey(cfg, filename!);
      const date = new Date().toUTCString();
      const resource = `/${bucket}/${key}`;
      const signature = hmacSha1(accessKeySecret as string,
        `PUT\n\n${mime}\n${date}\n${resource}`);
      const url = `https://${bucket}.${endpoint}/${key.split("/").map(encodeURIComponent).join("/")}`;
      const r = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": mime,
          Date: date,
          Authorization: `OSS ${accessKeyId}:${signature}`,
        },
        body: body as unknown as string,
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`OSS PUT ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const base = (publicBaseUrl || `https://${bucket}.${endpoint}`).replace(/\/$/, "");
      return { url: `${base}/${key.split("/").map(encodeURIComponent).join("/")}` };
    },
  };
}
