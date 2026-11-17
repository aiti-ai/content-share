# @aiti-ai/content-share

> Provider-based content sharing — from content to URL. 161 built-in targets (the full ShareX `.sxcu` catalog + China-friendly services + note archives) behind one dependency-free engine.

English · [简体中文](./README.zh-CN.md)

## About aiti

This package is part of the **aiti** ecosystem — a personal AI development workbench powered by [pi](https://pi.dev): **aiti-agent** (a self-hosted web workbench built on the open-source [pi-web](https://github.com/aiti-ai/pi-web)) plus debug injection into mainstream dev tools (aiti-devtools) and a rich extension system.

- Workbench (aiti-agent, built on pi-web): <https://github.com/aiti-ai/pi-web>
- Ecosystem monorepo: <https://github.com/aiti-ai/aiti-ai>
- Site: <https://aiti.pw>

Category: Content & sharing · Tags: `share` · `upload` · `paste` · `image-host` · `sxcu` · `sharex` · `gist` · `gitee` · `oss` · `joplin`

## What it does

Upload text, images or files to paste bins, image hosts, object storage or note archives through one unified provider API, and get a shareable URL back. **The package stops at the URL** — QR codes, clipboard writes and OS share sheets belong to the calling application.

## Why

- **161 built-in targets**: the full [ShareX CustomUploaders](https://github.com/ShareX/CustomUploaders) catalog (148 `.sxcu` configs, synced from upstream) plus China-friendly services (Gitee Snippet, Lsky Pro, SM.MS, Pastebin, Rentry, paste.rs, Alibaba OSS) and note archives (Joplin, Obsidian Local REST, memos, SiYuan, Flomo).
- **Data-driven providers**: `.sxcu` configs *are* providers. No per-service code — configs execute through a dependency-free engine (ShareX syntax parser port, 4 body types, JSONPath/regex URL extraction).
- **Runtime registration**: `registry.register(provider)` / `registry.addEntry(entry, config)` for user-defined or remotely delivered targets.
- **Remote catalog overlay**: the recommended set, dead-service flags and new entries can be maintained at a central JSON URL (disk cache + TTL + stale fallback).
- **Redaction hook**: `share()` accepts `hooks.transformText`, so callers can inject a secrets scanner (e.g. [`@aiti-ai/secret-mask-core`](https://www.npmjs.com/package/@aiti-ai/secret-mask-core)) before upload. This package itself has no opinion on content.
- **Categories**: `publish` (public URL), `archive` (Joplin/Obsidian deep links), `bookmark`, `local` (local session links).
- **Zero runtime dependencies.**

## Install

```bash
npm install @aiti-ai/content-share
```

Node.js >= 22.18.0.

## Quick start

```ts
import { Registry, share } from "@aiti-ai/content-share";

const registry = new Registry();
await registry.init(); // loads the 161-entry catalog

const provider = registry.get("gitee-gist")!;
const result = await share(
  provider,
  { text: "# Hello\nShared from my workbench" },
  { provider: "gitee-gist", values: { token: process.env.GITEE_TOKEN! }, tags: "notes" },
  { title: "Hello", tags: "notes" },
);
console.log(result.url);
// result.url is the terminal output — generate a QR / share sheet in your app.
```

### Local demo (custom-http provider)

```bash
node mocks/src/paste-demo.ts 8931
content-share share --provider custom --endpoint http://127.0.0.1:8931/api/pastes \
  --title "Demo" --tags "test" --text "hello"
```

### CLI

```bash
content-share list [text|image|file]              # list targets by content kind
content-share share --provider <id> [--file f]    # upload and print the URL
content-share import-sxcu <file.sxcu>             # validate + inspect a config
content-share mock [paste-demo] [--port 8931]     # start the demo paste server
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
| `aliyunOssProvider` / `localLinkProvider` / `customProvider` | code providers (V1 signature / no upload / template) |

Full contracts: [docs/api.md](docs/api.md). Architecture: [docs/design.md](docs/design.md). Writing your own uploader: [docs/custom-uploader-guide.md](docs/custom-uploader-guide.md).

## Maintaining the catalog

```bash
npm run catalog:sync     # fetch all 148 .sxcu files from ShareX/CustomUploaders
npm run build:catalog    # rebuild catalog/index.json (metadata.json overlay)
npm run verify           # typecheck + tests + build + catalog reproducibility
```

## Used by

[**aiti-agent**](https://github.com/aiti-ai/pi-web)'s `aiti-msg-share` extension — share sessions, messages, selections, files and images with secret redaction and QR codes.

## License

MIT. The `.sxcu` syntax semantics are derived from [ShareX](https://github.com/ShareX/ShareX) (GPL v3) by independent reimplementation — no ShareX source code is included. `.sxcu` configs are redistributed from the public ShareX/CustomUploaders repository.

[简体中文](./README.zh-CN.md)
