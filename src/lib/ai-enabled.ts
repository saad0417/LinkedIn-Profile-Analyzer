/** True when Gemini and/or the OpenRouter backup has an API key. AI buttons are hidden otherwise. */
export function aiEnabled(): boolean {
  return !!(process.env.GEMINI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
}
