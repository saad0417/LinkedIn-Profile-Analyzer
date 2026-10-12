import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { LLM_SETTINGS, LLMProviderError, type CompleteOptions, type LLMProvider } from "./core";

/** Gemini via the maintained `@google/genai` SDK. */
export class GeminiProvider implements LLMProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: LLM_SETTINGS.structuredTimeoutMs,
        // One attempt only: the route has a latency budget and the user can retry.
        retryOptions: { attempts: 1 },
      },
    });
  }

  async complete(system: string, user: string, options: CompleteOptions = {}): Promise<string> {
    const timeoutMs = options.timeoutMs ?? LLM_SETTINGS.timeoutMs;
    // Thinking tokens are billed and add latency, and these short rewriting tasks
    // don't need them: 2.5 Flash takes a zero budget, Gemini 3+ the minimal level.
    // output budget and add latency for these short tasks.
    const thinking = /2\.5-flash/i.test(this.model)
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : /gemini-[3-9]/i.test(this.model)
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
        : {};
    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: user }] }],
        config: {
          systemInstruction: system,
          temperature: LLM_SETTINGS.temperature,
          maxOutputTokens: options.maxOutputTokens ?? LLM_SETTINGS.maxOutputTokens,
          candidateCount: 1,
          abortSignal: AbortSignal.timeout(timeoutMs),
          ...(options.json ? { responseMimeType: "application/json" } : {}),
          ...thinking,
        },
      });
      const text = res.text;
      if (!text || !text.trim()) throw new LLMProviderError(null, "Empty completion");
      return text;
    } catch (err) {
      if (err instanceof LLMProviderError) throw err;
      const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : null;
      // Deliberately drop the upstream message: it can echo request details.
      throw new LLMProviderError(status);
    }
  }
}
