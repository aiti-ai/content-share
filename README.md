# @aiti-ai/content-share

[![npm](https://img.shields.io/npm/v/@aiti-ai/content-share)](https://www.npmjs.com/package/@aiti-ai/content-share)

**Provider-based content sharing — from content to URL.** Zero runtime dependencies.

Upload text, images or files to paste bins, image hosts, object storage or note archives through one unified provider API, and get a shareable URL back. The package stops at the URL: QR codes, clipboard writes and OS share sheets belong to the calling application.

## Why

- **161 built-in targets**: the full [ShareX CustomUploaders](https://github.com/ShareX/CustomUploaders) catalog (148 `.sxcu` configs, synced upstream) plus China-friendly services (Gitee Snippet, Lsky Pro, SM.MS, Pastebin, Rentry, paste.rs, Alibaba OSS) and note archives (Joplin, Obsidian, memos, SiYuan, Flomo).
- **Data-driven providers**: `.sxcu` configs are providers. No per-service code needed — configs execute through a dependency-free engine (ShareX syntax parser port, 4 body types, JSONPath/regex URL extraction).
- **Runtime registration**: `registry.register(customProvider())` / `registry.addEntry(...)` for user-defined or remotely delivered targets.
- **Remote catalog overlay**: recommended set, dead-service flags and new entries can be maintained at a central JSON URL (disk cache + TTL + stale fallback — same pattern as aiti-model-wizard).
- **Redaction hook**: `share()` accepts `hooks.transformText` so callers can inject a secrets scanner (e.g. `@aiti-ai/secret-mask-core`) before upload. This package itself has no security/opinion on content.
- **Categories**: `publish` (public URL), `archive` (Joplin/Obsidian deep links), `bookmark`, `local` (local session links).

## Install

```bash
npm install @aiti-ai/content-share
```

Node.js >= 22.18.0. No runtime deps.

## Quick start

```ts
import { Registry, share, customProvider } from "@aiti-ai/content-share";

const registry = new Registry();
await registry.init(); // loads 161-entry catalog

const provider = registry.get("gitee-gist")!;
const result = await share(
  provider,
  { text: "# Hello\nShared from pi-web" },
  { provider: "gitee-gist", values: { token: process.env.GITEE_TOKEN! }, tags: "notes" },
  { title: "Hello", tags: "notes" },
);
console.log(result.url);
// result.url — the package's terminal output. Generate a QR / share sheet in your app.
```

### Local demo (custom-http provider)

```bash
node mocks/src/paste-demo.ts 8931
content-share share --provider custom --endpoint http://127.0.0.1:8931/api/pastes \
  --title "Demo" --tags "test" --text "hello"
```

### CLI

```bash
content-share list [text|image|file]       # list targets by content kind
content-share share --provider <id> ...     # upload and print URL
content-share help
```

## API (essentials)

| Export | Purpose |
| --- | --- |
| `Registry` | `init(forceRefresh?)`, `get(id)`, `list(kinds?)`, `catalog()`, `register()`, `addEntry()` |
| `share(provider, content, target, meta?, hooks?)` | validate → redaction hook → upload → `ShareResult{url, extra}` |
| `loadOverlay` / `applyOverlay` | remote catalog maintenance (TTL cache, single-flight) |
| `executeSxcu(config, content, target, meta?, hooks?)` | execute one `.sxcu` config |
| `normalizeSxcu({id, config, category?})` | turn a config into a `ShareProvider` |
| `parseSyntax` / `applySyntax` / `migrateOldSyntax` | ShareX syntax parser (`{json:…}`, legacy `$json:…$`) |
| `aliyunOssProvider` / `localLinkProvider` / `customProvider` | code providers |

See [docs/api.md](docs/api.md) for full contracts and [docs/design.md](docs/design.md) for architecture.

## Syncing the catalog

```bash
npm run catalog:sync     # fetch all 148 .sxcu files from ShareX/CustomUploaders
npm run build:catalog    # rebuild catalog/index.json (metadata.json overlay)
```

## License

MIT. The `.sxcu` syntax semantics are derived from [ShareX](https://github.com/ShareX/ShareX) (GPL v3) by independent reimplementation — no ShareX source code is included.

中文文档见 [README.zh-CN.md](README.zh-CN.md)。
