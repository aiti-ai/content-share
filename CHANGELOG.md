# Changelog

## 0.1.0 (2026-11-17)

- Initial release: provider registry with 161 built-in targets (148 ShareX `.sxcu` catalog + 13 native entries).
- Dependency-free `.sxcu` engine: 4 body types, ShareX syntax parser (json/regex/base64/header/response/…), legacy `$…$` migration.
- Code providers: Alibaba Cloud OSS (V1 signature), local-link, custom template.
- Remote catalog overlay with TTL disk cache and single-flight loading.
- `share()` pipeline with optional redaction hook.
- CLI: `list`, `share`, `help`. Demo paste server in `@aiti-ai/content-share-mocks`.
