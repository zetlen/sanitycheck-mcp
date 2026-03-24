// src/client-inference.ts
import { createLogger } from "./logger.js";

const log = createLogger("client");

export const CLIENT_MODEL_MAP: Record<string, string> = {
  "claude-code": "claude",
  "claude-desktop": "claude",
  "copilot": "gpt",
  "github-copilot": "gpt",
};

export function inferModel(clientName: string | undefined): string | null {
  if (!clientName) {
    log.debug("infer", { clientName: null, inferred: null, reason: "no client name provided" });
    return null;
  }
  const model = CLIENT_MODEL_MAP[clientName.toLowerCase()] ?? null;
  if (!model) {
    log.warn("infer-unknown-client", { clientName, knownClients: Object.keys(CLIENT_MODEL_MAP) });
  } else {
    log.debug("infer", { clientName, inferred: model });
  }
  return model;
}
