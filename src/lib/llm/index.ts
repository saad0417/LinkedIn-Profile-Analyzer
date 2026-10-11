/**
 * Provider-agnostic LLM access. Used only for optional rewrites and
 * explanations; scoring never touches this module.
 *
 * Gemini is the primary provider and OpenRouter the backup: when both keys are
 * set, a request that fails on Gemini (bad key, quota, timeout, outage) is
 * retried once on OpenRouter. Either key alone also works. LLM_PROVIDER only
 * chooses which one goes first ("gemini" by default).
 */
import { FallbackProvider } from "./fallback";
import { GeminiProvider } from "./gemini";
import { OpenRouterProvider } from "./openrouter";

import { LLMUnavailableError, type LLMProvider } from "./core";

export {
  LLMUnavailableError,
  LLMProviderError,
  LLM_SETTINGS,
  structuredTokenBudget,
  type CompleteOptions,
  type LLMProvider,
} from "./core";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b-it:free";

let override: LLMProvider | null = null;

/** Test seam: inject a fake provider (pass null to restore env-based selection). */
export function setProviderForTesting(p: LLMProvider | null): void {
  override = p;
}

function configured(): { name: string; provider: LLMProvider }[] {
  const gemini = process.env.GEMINI_API_KEY?.trim();
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  const chain: { name: string; provider: LLMProvider }[] = [];
  if (gemini) {
    chain.push({
      name: "gemini",
      provider: new GeminiProvider(gemini, process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL),
    });
  }
  if (openrouter) {
    chain.push({
      name: "openrouter",
      provider: new OpenRouterProvider(openrouter, process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL),
    });
  }
  if ((process.env.LLM_PROVIDER ?? "").trim().toLowerCase() === "openrouter") chain.reverse();
  return chain;
}

/** True when at least one provider has a key. */
export function hasProvider(): boolean {
  return !!override || configured().length > 0;
}

/**
 * Returns the provider chain. Throws LLMUnavailableError when no provider has
 * an API key, so callers can answer 503 without spending quota.
 */
export function getProvider(): LLMProvider {
  if (override) return override;
  const chain = configured();
  if (chain.length === 0) throw new LLMUnavailableError();
  return chain.length === 1 ? chain[0].provider : new FallbackProvider(chain);
}

export { buildPrompt, postProcess, guardNumbers } from "./prompts";
export { runTask, type TaskResult } from "./run";
export { parseLLMTask } from "./validate";
