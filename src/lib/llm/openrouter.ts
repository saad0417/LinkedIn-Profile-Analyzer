import { LLM_SETTINGS, LLMProviderError, type CompleteOptions, type LLMProvider } from "./core";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Extra output room for reasoning models, whose hidden reasoning counts against max_tokens. */
const REASONING_HEADROOM = 800;

/**
 * OpenRouter's OpenAI-compatible chat completions API, via plain fetch.
 * `model` may be a comma-separated list: OpenRouter then tries each in order
 * (its `models` fallback), which keeps the free backup usable when one free
 * model is rate-limited upstream.
 */
export class OpenRouterProvider implements LLMProvider {
  private readonly models: string[];

  constructor(
    private readonly apiKey: string,
    model: string,
  ) {
    this.models = model
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  async complete(system: string, user: string, options: CompleteOptions = {}): Promise<string> {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          // Optional attribution headers recognised by OpenRouter.
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          "X-Title": "Parsewiser",
        },
        body: JSON.stringify({
          model: this.models[0],
          ...(this.models.length > 1 ? { models: this.models } : {}),
          // Keep any reasoning short and out of the returned text.
          reasoning: { effort: "low", exclude: true },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: LLM_SETTINGS.temperature,
          // No response_format: json_object mode rejects top-level arrays on some
          // models. Callers parse JSON defensively instead.
          max_tokens: (options.maxOutputTokens ?? LLM_SETTINGS.maxOutputTokens) + REASONING_HEADROOM,
          stream: false,
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? LLM_SETTINGS.timeoutMs),
        cache: "no-store",
      });
    } catch {
      throw new LLMProviderError(null);
    }
    if (!res.ok) throw new LLMProviderError(res.status);

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new LLMProviderError(res.status, "Malformed completion");
    }
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new LLMProviderError(res.status, "Empty completion");
    return content;
  }
}
