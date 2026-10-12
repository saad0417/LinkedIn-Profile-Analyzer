/** Shared LLM primitives (kept separate from index.ts to avoid import cycles). */

/** Per-call overrides. Providers fall back to LLM_SETTINGS for anything omitted. */
export interface CompleteOptions {
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Ask for a JSON response where the provider supports it natively (Gemini). Parsing stays defensive either way. */
  json?: boolean;
}

export interface LLMProvider {
  complete(system: string, user: string, options?: CompleteOptions): Promise<string>;
}

/** Thrown when no provider can be used (missing key, unknown provider name). */
export class LLMUnavailableError extends Error {
  constructor(message = "LLM provider is not configured") {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

/** Every configured provider's site-wide quota is used up for now (see budget.ts). */
export class LLMBudgetError extends Error {
  readonly scope: "minute" | "day";
  /** Seconds until the soonest provider has budget again. */
  readonly retryAfter: number;
  constructor(scope: "minute" | "day", retryAfter: number) {
    super("All AI providers are at their quota");
    this.name = "LLMBudgetError";
    this.scope = scope;
    this.retryAfter = retryAfter;
  }
}

/** Thrown by providers for upstream failures. Carries only a status code, never provider text. */
export class LLMProviderError extends Error {
  readonly status: number | null;
  constructor(status: number | null, message = "LLM provider request failed") {
    super(message);
    this.name = "LLMProviderError";
    this.status = status;
  }
}

/** Shared generation settings: low temperature, modest output, bounded latency. */
export const LLM_SETTINGS = {
  temperature: 0.3,
  maxOutputTokens: 400,
  timeoutMs: 20_000,
  /** Structured tasks (batch rewrites, LinkedIn review, resume generation) return far more text. */
  structuredTimeoutMs: 45_000,
} as const;

const STRUCTURED_DEFAULT_TOKENS = 3000;

/**
 * Output budget for the structured tasks. Server-side switch:
 * LLM_STRUCTURED_MAX_TOKENS (clamped to 800..16000). Raise it for models that
 * write long JSON, or when using a paid tier.
 */
export function structuredTokenBudget(): number {
  const n = Number(process.env.LLM_STRUCTURED_MAX_TOKENS);
  if (!Number.isFinite(n) || n <= 0) return STRUCTURED_DEFAULT_TOKENS;
  return Math.min(16_000, Math.max(800, Math.round(n)));
}
