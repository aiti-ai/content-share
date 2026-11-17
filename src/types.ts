/**
 * Public contracts for @aiti-ai/content-share.
 *
 * Scope note: this package ENDS at "obtain a shareable URL". QR codes,
 * clipboard writes, OS share sheets and UI are the caller's responsibility.
 */

export type ContentKind = "text" | "image" | "file";

export type ShareCategory = "publish" | "archive" | "bookmark" | "local";

export type ShareContent =
  | { text: string; filename?: string }
  | { buffer: Uint8Array; filename: string; mime: string };

export interface MetaField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "textarea";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
}

export interface TargetConfig {
  /** Provider id from the catalog (e.g. "catbox.moe"). */
  provider: string;
  /** User-supplied values for the provider's metaFields (tokens, keys, ...). */
  values: Record<string, string>;
  /** Optional default tags/directory prefix applied at share time. */
  tags?: string;
  pathPrefix?: string;
}

export interface ShareResult {
  url: string;
  extra?: {
    rawUrl?: string;
    deletionUrl?: string;
    thumbnailUrl?: string;
    id?: string;
    [key: string]: string | undefined;
  };
}

export interface ProbeResult {
  ok: boolean;
  detail?: string;
  latencyMs?: number;
}

/** Redaction hook: the caller (pi-web extension) injects secret-mask here. */
export interface ShareHooks {
  transformText?: (text: string) => { text: string; hits?: Array<{ rule: string; count: number }> };
}

export interface ShareProvider {
  id: string;
  label: string;
  kinds: ContentKind[];
  category: ShareCategory;
  maxBytes: number;
  metaFields: MetaField[];
  /** Long-lived background services (Joplin/Obsidian) can be probed. */
  probe?: (cfg: TargetConfig) => Promise<ProbeResult>;
  upload(content: ShareContent, meta: Record<string, string>, cfg: TargetConfig, hooks?: ShareHooks): Promise<ShareResult>;
}

export interface SxcuConfig {
  Version?: string;
  Name?: string;
  DestinationType?: string;
  RequestMethod?: string;
  RequestURL: string;
  Body?: "MultipartFormData" | "JSON" | "FormURLEncoded" | "Binary" | "XML";
  Parameters?: Record<string, string>;
  Headers?: Record<string, string>;
  Arguments?: Record<string, string>;
  FileFormName?: string;
  Data?: string;
  RegexList?: string[];
  URL?: string;
  ThumbnailURL?: string;
  DeletionURL?: string;
  ErrorMessage?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  kinds: ContentKind[];
  category: ShareCategory;
  source: "sharex" | "aiti" | "user";
  auth: "none" | "token" | "key";
  recommended?: boolean;
  note?: string;
  status?: "ok" | "legacy" | "dead" | "unknown";
  file?: string;
  code?: boolean;
  /** Inline config (remote overlay entries). */
  sxcu?: SxcuConfig;
}
