/**
 * @aiti-ai/content-share — provider-based content sharing, from content to URL.
 *
 * Scope: this package uploads text/images/files through configurable providers
 * and returns a shareable URL. QR codes, clipboard and OS share sheets belong
 * to the calling application.
 */
export type * from "./types.ts";
export { Registry, type RegistryOptions } from "./registry.ts";
export { share, type PipelineResult } from "./pipeline.ts";
export { loadOverlay, applyOverlay, type RemoteOverlay, type RemoteOptions, type RemoteResult } from "./remote.ts";
export { normalizeSxcu, simpleProbe } from "./sxcu/normalize.ts";
export { executeSxcu, configKinds, detectValueFields } from "./sxcu/engine.ts";
export { parseSyntax, applySyntax, migrateOldSyntax } from "./sxcu/syntax.ts";
export { aliyunOssProvider, ossAuthorization } from "./oss.ts";
export { localLinkProvider } from "./local-link.ts";
export { customProvider } from "./custom.ts";
