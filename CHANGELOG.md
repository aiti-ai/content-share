# Changelog

## 0.1.11 (2026-11-19)

- Engine: a template-extracted URL with an empty parameter value (e.g. `?h=`) now fails with a clear error instead of returning an unusable share link.

## 0.1.10 (2026-11-19)

- share() now validates the content kind against provider.kinds and fails fast with a "kind mismatch" error (image buffer to a text-only target etc.).
- .sxcu engine: text content uploaded to a config with an explicit FileFormName now goes out as a real text/plain file part (ShareX temp-file semantics) instead of a plain form field — fixes "no files given"-style rejections on file-style text hosts (catbox, pomf family, ...).
- Binary body payloads pass through byte-exact (Uint8Array) — the latin1 string round-trip corrupted bytes >= 0x80.

## 0.1.9 (2026-11-19)

- loadOverlay logs the failure reason (network/cert/parse) instead of silently falling back to the bundled catalog.

## 0.1.8 (2026-11-19)

- Multilingual catalog data: `CatalogEntry.note` / overlay notes accept a zh/en pair (`LocalizedText`), so remote catalogs can carry bilingual copy.
- `loadOverlay` accepts the published audit document (aiti.pw /share-targets.json `providers`/`setupProviders`/`labels` shape) in addition to the classic overlay: verdicts dead/vpn-unreachable/template map to status "dead", bilingual notes and labels pass through. New export `overlayFromDoc`.

## 0.1.7 (2026-11-19)

- Catalog: mark 44 targets dead from the 2026-11 upload audit — 26 with no DNS resolution (bakka.me, glot.io snippets, dtransfer.net, hnng.moe, tietuku.com, uploadfiles.io, git.io retirement, …) and 18 unreachable even via VPN routing (aboo.se, oshi.at, paste.ubuntu.com, ttm.sh, …). Registry no longer instantiates providers for dead entries (113 usable targets remain); they stay listed greyed-out in target managers.
- Notes on dead entries carry the audit evidence wording.

## 0.1.0 (2026-11-17)

- Initial release: provider registry with 161 built-in targets (148 ShareX `.sxcu` catalog + 13 native entries).
- Dependency-free `.sxcu` engine: 4 body types, ShareX syntax parser (json/regex/base64/header/response/…), legacy `$…$` migration.
- Code providers: Alibaba Cloud OSS (V1 signature), local-link, custom template.
- Remote catalog overlay with TTL disk cache and single-flight loading.
- `share()` pipeline with optional redaction hook.
- CLI: `list`, `share`, `help`. Demo paste server in `@aiti-ai/content-share-mocks`.
