/** local-link: no upload; builds a deep link to the local pi-web session/message. */
import type { ShareProvider, ShareResult } from "./types.ts";

export function localLinkProvider(): ShareProvider {
  return {
    id: "local-link",
    label: "Local link",
    kinds: ["text", "image", "file"],
    category: "local",
    maxBytes: 1024 * 1024,
    metaFields: [
      { key: "baseUrl", label: "pi-web base URL", type: "text", required: true, hint: "e.g. https://pi.alot.pw:57442/dev" },
      { key: "sessionId", label: "Session id", type: "text", required: false },
      { key: "messageId", label: "Message id (anchor)", type: "text", required: false },
    ],
    async upload(_content, meta, cfg) {
      const base = (cfg.values.baseUrl || meta.baseUrl || "").replace(/\/$/, "");
      if (!base) throw new Error("baseUrl is required for local-link");
      const session = cfg.values.sessionId || meta.sessionId;
      const message = cfg.values.messageId || meta.messageId;
      let url = session ? `${base}/?session=${encodeURIComponent(session)}` : base;
      if (message) url += `&msg=${encodeURIComponent(message)}`;
      const result: ShareResult = { url, extra: { id: message || session } };
      return result;
    },
  };
}
