/** Shared upload pipeline: validate → transform hook → provider.upload. */
import type { ShareContent, ShareHooks, ShareProvider, ShareResult, TargetConfig } from "./types.ts";

export interface PipelineResult extends ShareResult {
  hits?: Array<{ rule: string; count: number }>;
}

export async function share(
  provider: ShareProvider,
  content: ShareContent,
  target: TargetConfig,
  meta: Record<string, string> = {},
  hooks?: ShareHooks,
): Promise<PipelineResult> {
  const size = "text" in content ? Buffer.byteLength(content.text, "utf8") : content.buffer.byteLength;
  if (size > provider.maxBytes) {
    throw new Error(`Content too large: ${size} bytes > ${provider.maxBytes} bytes (${provider.id})`);
  }
  if ("text" in content && !content.text.trim()) throw new Error("Empty content");

  let transformHits: Array<{ rule: string; count: number }> | undefined;
  if (hooks?.transformText && "text" in content) {
    const transformed = hooks.transformText(content.text);
    // engine also calls transformText; pass hooks through but avoid double-transform by
    // letting the engine see already-transformed text and no hook for text content.
    if ("text" in content) {
      content = { ...content, text: transformed.text };
      transformHits = transformed.hits;
      hooks = { ...hooks, transformText: undefined };
    }
  }

  const result = await provider.upload(content, meta, target, hooks);
  return { ...result, hits: transformHits };
}
