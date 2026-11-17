# API reference

## `Registry`

```ts
const registry = new Registry({ url?, cacheDir?, ttlMs?, catalogDir?, fetchImpl? });
await registry.init(forceRefresh = false);
```

- `get(id)` → `ShareProvider | undefined`
- `list(kinds?)` → providers filtered by content kind
- `catalog()` → `CatalogEntry[]` (after remote overlay merge)
- `register(provider)` / `addEntry(entry, config)` → runtime additions

## `share(provider, content, target, meta?, hooks?): Promise<PipelineResult>`

- `content`: `{ text, filename? }` or `{ buffer, filename, mime }`
- `target`: `{ provider, values: Record<string,string>, tags?, pathPrefix? }`
- `hooks`: `{ transformText?: (text) => { text, hits? } }`
- returns `{ url, extra?, hits? }`; throws on oversize/empty/network/HTTP errors.

## `executeSxcu(config, content, target, meta?, hooks?, options?)`

Runs a single `.sxcu` config. `options.fetchImpl` allows injection (offline tests); `timeoutMs` defaults to 30s.

## `applySyntax(text, ctx)` / `parseSyntax` / `migrateOldSyntax`

ShareX syntax: `{json:data.url}`, `{json:{response}|data.url}`, `{regex:1}`, `{base64:x}`, `{header:key}`, `{response}`, `{input}`, `{filename}`, `{tags}`, `{title}`, `{random:6}`, escapes `\{`.

## Providers

| Provider | category | Auth fields | Notes |
| --- | --- | --- | --- |
| 148 ShareX `.sxcu` | publish | varies (mostly none) | kind from DestinationType |
| gitee-gist / lsky-pro / sm-ms / pastebin / rentry / paste.rs | publish | token / key | native configs |
| aliyun-oss | publish | endpoint, bucket, AK/SK | V1 signer, `pathPrefix` = directory |
| joplin / obsidian-local-rest / memos / siyuan / flomo | archive | token / webhook id | result url is an app deep link |
| local-link | local | baseUrl | no upload |
| custom | publish | endpoint | `{{content}}/{{title}}/{{tags}}` template |

## CLI

```
content-share list [text|image|file]
content-share share --provider <id> [--file f | --text t] [--title T] [--tags a,b] [--<field> value ...]
```
