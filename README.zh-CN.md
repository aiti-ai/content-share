# @aiti-ai/content-share

**按 provider 分享内容——从内容到 URL。** 零运行时依赖。

通过一个统一的 provider API，把文本、图片、文件上传到 paste 站、图床、对象存储或笔记库，返回可分享 URL。**包到 URL 为止**：二维码、剪贴板、系统分享归调用方。

## 为什么

- **内置 161 个目标**：[ShareX CustomUploaders](https://github.com/ShareX/CustomUploaders) 全量目录（148 份 `.sxcu`，脚本同步上游）+ 国内服务（Gitee Snippet、兰空图床、SM.MS、Pastebin、Rentry、paste.rs、阿里云 OSS）+ 笔记库（Joplin、Obsidian、memos、思源、flomo）。
- **数据驱动 provider**：`.sxcu` 配置即 provider——无需逐家写代码，统一引擎执行（ShareX 语法解析器移植、4 种 body、JSONPath/regex 取 URL）。
- **运行时注册** / **远端 overlay**（推荐集、死站标注可在线维护，磁盘缓存 + TTL + 过期兜底）。
- **脱敏 hook**：`share()` 接受 `hooks.transformText`，调用方可注入密钥扫描（如 `@aiti-ai/secret-mask-core`），包本身不干涉内容。
- **类别**：publish（公网 URL）/ archive（Joplin 等深链）/ bookmark / local（本机链接）。

## 安装 / 用法 / API

见 [README.md](README.md)（英文为主）；完整契约见 `docs/api.md`，架构见 `docs/design.md`。

```bash
npm run catalog:sync     # 同步 ShareX 148 份配置
npm run build:catalog    # 重建目录索引
npm test                 # 测试
```

MIT 许可。语法语义移植自 ShareX（GPL v3）的独立重实现，未包含其源码。
