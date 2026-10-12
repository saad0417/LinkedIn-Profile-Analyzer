import { LLMBudgetError, LLMProviderError, type CompleteOptions, type LLMProvider } from "./core";
import type { BudgetDecision } from "./budget";

export interface ChainEntry {
  name: string;
  provider: LLMProvider;
  /** Spends one unit of this provider's site-wide quota; a refusal skips the provider. */
  budget?: () => Promise<BudgetDecision>;
}

/**
 * Tries each provider in order and returns the first successful completion.
 * A provider whose site-wide quota is spent is skipped without being called.
 * Any upstream failure (bad or expired key, quota exhausted, timeout, outage)
 * moves on to the next provider; only the last provider's error is thrown.
 * If every provider was skipped for quota, throws LLMBudgetError.
 */
export class FallbackProvider implements LLMProvider {
  constructor(private readonly chain: ChainEntry[]) {}

  async complete(system: string, user: string, options?: CompleteOptions): Promise<string> {
    let last: unknown = null;
    const skipped: Extract<BudgetDecision, { ok: false }>[] = [];
    for (const { name, provider, budget } of this.chain) {
      if (budget) {
        const b = await budget();
        if (!b.ok) {
          skipped.push(b);
          console.warn(`[llm] ${name} skipped: site quota for this ${b.scope} reached`);
          continue;
        }
      }
      try {
        return await provider.complete(system, user, options);
      } catch (err) {
        last = err;
        const status = err instanceof LLMProviderError ? err.status : null;
        // Status only: never log prompts or provider messages.
        console.warn(`[llm] ${name} failed (status ${status ?? "n/a"})`);
      }
    }
    if (last) throw last;
    if (skipped.length) {
      const soonest = skipped.reduce((a, b) => (b.retryAfter < a.retryAfter ? b : a));
      throw new LLMBudgetError(skipped.every((s) => s.scope === "day") ? "day" : "minute", soonest.retryAfter);
    }
    throw new LLMProviderError(null);
  }
}
