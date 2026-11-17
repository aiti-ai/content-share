/**
 * custom: a blank user-defined template provider (superset of .sxcu with
 * {{content}}/{{title}}/{{tags}} variables). For arbitrary self-hosted
 * services; imported .sxcu files use the engine directly instead.
 */
import type { MetaField, ShareProvider, SxcuConfig } from "./types.ts";
import { normalizeSxcu } from "./sxcu/normalize.ts";
import { executeSxcu } from "./sxcu/engine.ts";

export function customProvider(): ShareProvider {
  const provider = normalizeSxcu({
    id: "custom",
    category: "publish",
    config: {
      Name: "Custom HTTP",
      DestinationType: "TextUploader,ImageUploader,FileUploader",
      RequestMethod: "POST",
      RequestURL: "https://example.com/api/paste",
      Body: "JSON",
      Data: "{\"title\":\"{{title}}\",\"tags\":\"{{tags}}\",\"content\":\"{{content}}\"}",
      Headers: { "Content-Type": "application/json" },
      URL: "$json:url$",
    },
  });
  const fields: MetaField[] = [
    { key: "endpoint", label: "Endpoint URL", type: "text", required: true, hint: "Overrides the template RequestURL" },
    ...provider.metaFields,
  ];
  const baseConfig: SxcuConfig = {
    Name: "Custom HTTP", DestinationType: "TextUploader,ImageUploader,FileUploader",
    RequestMethod: "POST", RequestURL: "https://example.com/api/paste", Body: "JSON",
    Data: '{"title":"{{title}}","tags":"{{tags}}","content":"{{content}}"}',
    Headers: { "Content-Type": "application/json" }, URL: "$json:url$",
  };
  return {
    ...provider, metaFields: fields,
    async upload(content, meta, target, hooks) {
      const cfg = { ...baseConfig, RequestURL: target.values.endpoint || meta.endpoint || baseConfig.RequestURL };
      return executeSxcu(cfg, content, target, meta, hooks);
    },
  };
}
