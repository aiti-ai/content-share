# @aiti-ai/content-share

> 按 provider 分享内容——从内容到 URL。内置 161 个目标（ShareX `.sxcu` 全量目录 + 国内直连服务 + 笔记库），统一由零依赖引擎执行。

[English](../README.md) · 简体中文

## 关于 aiti

本包是 **aiti** 生态的一部分——由 [pi](https://pi.dev) 驱动的个人 AI 开发工作台：**aiti-agent**（基于开源 [pi-web](https://github.com/aiti-ai/pi-web) 的自托管 Web 工作台），加上对主流开发工具的调试注入（aiti-devtools）与丰富的扩展体系。

- 工作台（aiti-agent，基于 pi-web）：<https://github.com/aiti-ai/pi-web>
- 生态主仓：<https://github.com/aiti-ai/aiti-ai>
- 站点：<https://aiti.pw>

分类：内容与分享 · 标签：`分享` · `上传` · `paste` · `图床` · `sxcu` · `sharex` · `gist` · `gitee` · `oss` · `joplin`

## 它做什么

通过一个统一的 provider API，把文本、图片或文件上传到 paste 站、图床、对象存储或笔记库，拿回一个可分享的 URL。**包到 URL 为止**——二维码、剪贴板写入、系统分享面板归调用方。

## 为什么

- **内置 161 个目标**：[ShareX CustomUploaders](https://github.com/ShareX/CustomUploaders) 全量目录（148 份 `.sxcu`，脚本同步上游）+ 国内直连服务（Gitee Snippet、兰空图床、SM.MS、Pastebin、Rentry、paste.rs、阿里云 OSS）+ 笔记库（Joplin、Obsidian Local REST、memos、思源、flomo）。
- **数据驱动 provider**：`.sxcu` 配置**就是** provider——无需逐家写代码，统一引擎执行（ShareX 语法解析器移植、4 种 body、JSONPath/regex 取 URL）。
- **运行时注册**：`registry.register(provider)` / `registry.addEntry(entry, config)`，支持用户自定义或远端下发的目标。
- **远端目录 overlay**：推荐集、死站标注、新条目可在中心 JSON URL 在线维护（磁盘缓存 + TTL + 过期兜底）。
- **脱敏 hook**：`share()` 接受 `hooks.transformText`，调用方可注入密钥扫描器（如 [`@aiti-ai/secret-mask-core`](https://www.npmjs.com/package/@aiti-ai/secret-mask-core)）。包本身不干涉内容。
- **类别**：`publish`（公网 URL）、`archive`（Joplin/Obsidian 深链）、`bookmark`、`local`（本机会话链接）。
- **零运行时依赖。**

## 安装

```bash
npm install @aiti-ai/content-share
```

需要 Node.js >= 22.18.0。

## 快速开始

```ts
import { Registry, share } from "@aiti-ai/content-share";

const registry = new Registry();
await registry.init(); // 载入 161 条目录

const provider = registry.get("gitee-gist")!;
const result = await share(
  provider,
  { text: "# 你好\n来自我的工作台" },
  { provider: "gitee-gist", values: { token: process.env.GITEE_TOKEN! }, tags: "笔记" },
  { title: "你好", tags: "笔记" },
);
console.log(result.url);
// result.url 即终态——二维码/分享面板在你的应用里生成。
```

### 本地演示（custom-http provider）

```bash
node mocks/src/paste-demo.ts 8931
content-share share --provider custom --endpoint http://127.0.0.1:8931/api/pastes \
  --title "演示" --tags "测试" --text "hello"
```

### CLI

```bash
content-share list [text|image|file]              # 按内容类型列出目标
content-share share --provider <id> [--file f]    # 上传并打印 URL
content-share import-sxcu <file.sxcu>             # 校验 + 检查兼容性
content-share mock [paste-demo] [--port 8931]     # 启动演示 paste 服务
```

## API（核心）

| 导出 | 用途 |
| --- | --- |
| `Registry` | `init(forceRefresh?)`、`get(id)`、`list(kinds?)`、`catalog()`、`register()`、`addEntry()` |
| `share(provider, content, target, meta?, hooks?)` | 校验 → 脱敏 hook → 上传 → `ShareResult{url, extra}` |
| `loadOverlay` / `applyOverlay` | 远端目录维护（TTL 缓存、单飞） |
| `executeSxcu(config, content, target, meta?, hooks?)` | 执行单份 `.sxcu` 配置 |
| `normalizeSxcu({id, config, category?})` | 配置 → `ShareProvider` |
| `parseSyntax` / `applySyntax` / `migrateOldSyntax` | ShareX 语法解析（`{json:…}`、旧式 `$json:…$`） |
| `aliyunOssProvider` / `localLinkProvider` / `customProvider` | 代码 provider（V1 签名 / 不上传 / 模板） |

完整契约见 [docs/api.md](docs/api.md)；架构见 [docs/design.md](docs/design.md)；自写上传器见 [docs/custom-uploader-guide.md](docs/custom-uploader-guide.md)。

## 维护目录

```bash
npm run catalog:sync     # 同步 ShareX/CustomUploaders 的 148 份 .sxcu
npm run build:catalog    # 重建 catalog/index.json（metadata.json overlay）
npm run verify           # typecheck + 测试 + 构建 + 目录可重现性
```

## 谁在用

[**aiti-agent**](https://github.com/aiti-ai/pi-web) 的 `aiti-msg-share` 扩展——分享会话/消息/划选/文件/图片，带脱敏与二维码。

## 许可

MIT。`.sxcu` 语法语义由 [ShareX](https://github.com/ShareX/ShareX)（GPL v3）独立重实现推导，未包含其源码。`.sxcu` 配置从公开的 ShareX/CustomUploaders 仓再分发。

[English](../README.md)
