/** Task dispatcher: build the prompt, call the provider once, validate the output. */
import type { LinkedInReview } from "@/lib/linkedin/types";
import type { LLMTask, ResumeContent } from "@/lib/types";
import { LLMProviderError, LLM_SETTINGS, structuredTokenBudget, type LLMProvider } from "./core";
import { buildPrompt, postProcess } from "./prompts";
import {
  buildBulletsPrompt,
  buildGeneratePrompt,
  buildReviewPrompt,
  parseBullets,
  parseGenerated,
  parseReview,
} from "./structured";

/** What a successful task produces. `text` is "" for the structured tasks. */
export interface TaskResult {
  text: string;
  items?: string[];
  review?: LinkedInReview;
  content?: ResumeContent;
}

/**
 * One provider call per task (a batch of bullets is one call). Throws
 * LLMProviderError when the provider fails or the output is unusable.
 */
export async function runTask(task: LLMTask, provider: LLMProvider): Promise<TaskResult> {
  const structured = { maxOutputTokens: structuredTokenBudget(), timeoutMs: LLM_SETTINGS.structuredTimeoutMs, json: true };
  switch (task.task) {
    case "rewrite-bullets": {
      const { system, user } = buildBulletsPrompt(task);
      return { text: "", items: parseBullets(task, await provider.complete(system, user, structured)) };
    }
    case "linkedin-review": {
      const { system, user } = buildReviewPrompt(task);
      return { text: "", review: parseReview(task, await provider.complete(system, user, structured)) };
    }
    case "generate-resume": {
      const { system, user } = buildGeneratePrompt(task);
      return { text: "", content: parseGenerated(task, await provider.complete(system, user, structured)) };
    }
    default: {
      const { system, user } = buildPrompt(task);
      const text = postProcess(task, await provider.complete(system, user));
      if (!text) throw new LLMProviderError(null, "Empty completion after cleanup");
      return { text };
    }
  }
}
