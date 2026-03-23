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
  if (!clientName) return null;
  const model = CLIENT_MODEL_MAP[clientName.toLowerCase()] ?? null;
  log.debug("infer", { clientName, inferred: model });
  return model;
}
