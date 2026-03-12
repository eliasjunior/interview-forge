// ─────────────────────────────────────────────────────────────────────────────
// Composition root for the AI layer
//
// This is the only file that knows which concrete adapter is in use.
// To switch providers (OpenAI, local model, mock for tests …):
//   1. Implement AIProvider in a new adapter file
//   2. Change the import below — nothing else in the codebase changes
// ─────────────────────────────────────────────────────────────────────────────

export type { AIProvider } from "./port.js";

import type { AIProvider } from "./port.js";
import { AnthropicAIProvider } from "./anthropic.js";
import { CachingAIProvider } from "./cache.js";

export function createAIProvider(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in environment.");

  const anthropic = new AnthropicAIProvider(apiKey);
  return new CachingAIProvider(anthropic);
}
