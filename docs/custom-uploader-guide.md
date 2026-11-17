# Custom uploader guide (ShareX `.sxcu` compatibility)

`content-share` executes [ShareX](https://github.com/ShareX/CustomUploaders) `.sxcu`
configs directly, so any of the 148 upstream configs (plus your own) works as a
provider without writing code.

## Config shape

Only 16 keys exist in the whole upstream catalog:

| Key | Purpose |
| --- | --- |
| `Name` | Display name |
| `DestinationType` | `ImageUploader` / `TextUploader` / `FileUploader` / `URLShortener` → content kinds |
| `RequestMethod` | `POST` / `PUT` / … |
| `RequestURL` | Endpoint; may contain `<field>` placeholders and `{json:…}` syntax |
| `Parameters` | Query-string values |
| `Headers` | Static request headers |
| `Body` | `MultipartFormData` / `JSON` / `FormURLEncoded` / `Binary` |
| `Arguments` | Multipart/urlencoded extra fields |
| `FileFormName` | Multipart file field name (default `file`) |
| `Data` | Raw body template for `JSON`/`XML` |
| `RegexList` | Patterns consumed by `{regex:N}` |
| `URL` | Response → share URL expression |
| `ThumbnailURL` | Optional thumbnail expression |
| `DeletionURL` | Optional delete-link expression |
| `ErrorMessage` | Optional error extraction |
| `Version` | ShareX metadata (ignored) |

## Value syntax

Two syntaxes are accepted; legacy `$…$` is migrated to braces at load time.

```
{json:data.url}                 JSONPath into the response body
{json:{response}|data.url}      explicit input | path
{regex:1}                       RegexList[0] capture group
{base64:value}                  base64-encode
{header:location}               response header
{responseurl} {response} {input} {filename} {random:6} {urlencode:x} {tags} {title}
\{literal\}                     escaped braces
```

Double-brace variables (`{{content}}`, `{{title}}`, `{{tags}}`, `{{filename}}`)
are our extension for native configs; they are substituted after syntax parsing
so braces inside shared content never break JSON.

## Placeholders become setup fields

Any `<something>` inside `RequestURL`, `Headers`, `Arguments`, `Parameters` or
`Data` is treated as a required user field. Examples:

```jsonc
"RequestURL": "https://flomoapp.com/iwh/<webhook_id>/"   → field: webhook_id
"Headers": { "Authorization": "Bearer <token>" }          → field: token
"RequestURL": "https://x/y?key=<API KEY HERE>"            → field: api_key_here
```

The extension renders these as a setup form and stores values in
`configDir/targets.json` (mode 0600). Values never reach the browser again
(responses are masked).

## Ready-made configs worth importing

| Service | Kind | Note |
| --- | --- | --- |
| `catbox.moe` | image/text/file | Anonymous, permanent; slow from mainland China |
| `paste.rs` | text | Anonymous, trivial |
| `imgbb.com` | image | Free API key |
| `gofile.io` | file | Anonymous |
| `0x0.st` | image | Intermittent 500 / Cloudflare |
| `uguu.se` | image | Intermittent 502 |
| `dpaste.com`, `bpaste.net`, `glot.io` | text | Anonymous |
| `Jirafeau`, `chevereto`, `file.io` | file/image | Varies |

Bundled native configs (not in ShareX upstream): Gitee Snippet, Lsky Pro, SM.MS,
Pastebin, Rentry, paste.rs, Alibaba OSS (code provider), Joplin, Obsidian Local
REST, memos, SiYuan, Flomo.

## Writing your own

Start from the blank template in the target manager ("Custom HTTP"), or import a
ShareX config and adjust it. Validate with:

```bash
content-share list            # confirms the provider loaded
content-share share --provider <id> --text hello
```

Common mistakes:

- `Body: "JSON"` with `Data` containing `$json:` → that's response syntax, not body syntax; use `{{content}}`.
- Missing `FileFormName` for multipart → defaults to `file`, which most hosts accept but not all.
- `URL` left empty → the package falls back to the first `http(s)://` token in the response (works for `0x0.st`/`paste.rs` style plain-text replies).
