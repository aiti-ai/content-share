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

/**
 * A selectable container (notebook / folder / directory) offered by a provider.
 * ids are opaque provider-side strings (Joplin folder id, SiYuan notebook id,
 * Obsidian vault path).
 */
export interface Container {
  id: string;
  /** Display label of the container itself. */
  label: string;
  /** Parent container id (full-list tree mode). */
  parent?: string;
  /** Full path label ("Notebook A / Sub B") for flat rendering of trees. */
  path?: string;
}

/**
 * Declarative container listing for sxcu configs: describes one listing endpoint
 * (notebooks / folders / directories). Credentials in the URL/headers are filled
 * from the target's stored values server-side — they never reach the browser.
 */
export interface ContainerSpec {
  /** Placeholder the selected container id is injected into at upload time. */
  field: string;
  /** Picker label (localized text). */
  label?: LocalizedText;
  /** When true an empty selection is valid ("service default"). Default true. */
  optional?: boolean;
  /** Listing URL; fills `<values>` and `{{parent}}` (per-parent lazy listing mode). */
  listUrl: string;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  /** Dotted path to the items array in the response ("items", "data.notebooks"). */
  itemsPath?: string;
  idField?: string;
  labelField?: string;
  /** Presence switches to full-list tree mode: one paginated fetch, tree built from parentField. */
  parentField?: string;
  /** Keep only items whose fields equal these values (e.g. {"type":"folder"}). */
  filter?: Record<string, string>;
  /** Paginated listing (Joplin: { param: "page", moreField: "has_more" }). */
  pages?: { param: string; moreField: string };
}

/** Runtime container capability exposed by a provider. */
export interface ContainerQuery {
  /** Placeholder the selected container id is injected into at upload time. */
  field: string;
  /** Picker label (localized text). */
  label?: LocalizedText;
  /** List containers; parent scopes per-parent lazy listing modes. */
  list(cfg: TargetConfig, parent?: string): Promise<Container[]>;
}

export interface TargetConfig {
  /** Provider id from the catalog (e.g. "catbox.moe"). */
  provider: string;
  /** User-supplied values for the provider's metaFields (tokens, keys, ...). */
  values: Record<string, string>;
  /** Optional default tags/directory prefix applied at share time. */
  tags?: string;
  pathPrefix?: string;
  /** Selected container id (notebook / folder / directory); empty = service default. */
  container?: string;
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
  /** Container selection capability (notebooks / folders / directories), when supported. */
  containers?: ContainerQuery;
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
  /** aiti extension: declarative container selection (notebook/folder picker). */
  Container?: ContainerSpec;
}

/** Bilingual display text: plain string (single language) or zh/en pair. */
export type LocalizedText = string | { zh?: string; en?: string };

export interface CatalogEntry {
  id: string;
  name: string;
  kinds: ContentKind[];
  category: ShareCategory;
  source: "sharex" | "aiti" | "user";
  auth: "none" | "token" | "key";
  recommended?: boolean;
  note?: LocalizedText;
  status?: "ok" | "legacy" | "dead" | "unknown";
  file?: string;
  code?: boolean;
  /** Inline config (remote overlay entries). */
  sxcu?: SxcuConfig;
}
