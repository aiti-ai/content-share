# Design (English primary)

## Scope

`content-share` converts content (text/image/file) into a shareable URL through a pluggable provider. It deliberately stops there. QR codes, clipboard and OS share sheets are application concerns.

## Architecture

```
ShareContent ──▶ share() pipeline ──▶ Provider.upload() ──▶ ShareResult { url, extra }
                   │                       │
                   ├─ maxBytes guard       ├─ .sxcu engine (data-driven, 161 targets)
                   └─ transformText hook   ├─ aliyun-oss (V1 signature, code)
                                           ├─ local-link (no upload, code)
                                           └─ custom (template superset, code)
```

### Provider layer is data

ShareX's CustomUploaders repository publishes 148 `.sxcu` configs — declarative HTTP definitions with a tiny field union (16 keys total): `DestinationType` → content kind, `RequestURL`/`Parameters`/`Headers`/`Body` (Multipart/JSON/FormURLEncoded/Binary) → request, `URL`/`DeletionURL`/`ThumbnailURL` → response extraction via `$json:path$` / `$regex:N$`. 147 of 148 are anonymous; only imgbb needs a key. `scripts/sync-sharex-catalog.mjs` mirrors the catalog; `scripts/build-catalog.mjs` indexes it with a metadata overlay (recommended/dead/legacy notes).

China-friendly services and note archives absent from ShareX's catalog are authored as native `.sxcu` files in `catalog/aiti/` and execute through the same engine.

### Syntax parser

`src/sxcu/syntax.ts` is a dependency-free reimplementation of ShareX's `ShareXSyntaxParser` semantics (brace recursion, `:` params, `|` separators, `\` escapes), with function support for json/regex/base64/header/response/responseurl/input/filename/random/urlencode/select/title/tags. Legacy `$json:x$` syntax is migrated to `{json:x}` at load time, matching ShareX's own `MigrateOldSyntax`.

### Remote overlay

Mirrors aiti-model-wizard's catalogue maintenance: a central JSON URL supplies `{recommended, status, note, entries}` diffs; `loadOverlay()` applies a 24h TTL disk cache with stale fallback and single-flight dedup. Recommended targets and dead-service flags are an operational concern, not a release concern.

### Redaction hook

`ShareHooks.transformText` lets the caller scan text before upload (pi-web injects `@aiti-ai/secret-mask-core`). The pipeline applies it once, passes already-redacted text to the engine, and reports hit counts in `PipelineResult.hits`. Binary content is never transformed.

## Testing

`npm test` — 16 tests: syntax vectors, 4 body types against local mock servers, regex/JSONPath extraction, catalog invariants, OSS signature fixed vector, overlay merge, size guard. No network calls during tests.

## License note

ShareX is GPL v3. We reimplemented documented syntax semantics independently; no ShareX source is copied into this package. `.sxcu` configs (JSON) are redistributed from the public ShareX/CustomUploaders repository.
