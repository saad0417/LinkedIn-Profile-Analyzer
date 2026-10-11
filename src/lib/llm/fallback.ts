import { LLMProviderError, type CompleteOptions, type LLMProvider } from "./core";

/**
 * Tries each provider in order and returns the first successful completion.
 * Any upstream failure (bad or expired key, quota exhausted, timeout, outage)
 * moves on to the next provider; only the last provider's error is thrown.
 */
export class FallbackProvider implements LLMProvider {
  constructor(private readonly chain: { name: string; provider: LLMProvider }[]) {}

  async complete(system: string, user: string, options?: CompleteOptions): Promise<string> {
    let last: unknown = new LLMProviderError(null);
    for (const [i, { name, provider }] of this.chain.entries()) {
      try {
        return await provider.complete(system, user, options);
      } catch (err) {
        last = err;
        if (i < this.chain.length - 1) {
          const status = err instanceof LLMProviderError ? err.status : null;
          // Status only: never log prompts or provider messages.
          console.warn(`[llm] ${name} failed (status ${status ?? "n/a"}), falling back`);
        }
      }
    }
    throw last;
  }
}
