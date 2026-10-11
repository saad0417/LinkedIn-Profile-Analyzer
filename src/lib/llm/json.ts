/** Defensive JSON extraction from model output (fences, preambles, trailing commas). */

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    try {
      // Trailing commas and smart quotes used as JSON delimiters are the common slips.
      return JSON.parse(s.replace(/,\s*([\]}])/g, "$1").replace(/[“”]/g, '"'));
    } catch {
      return undefined;
    }
  }
}

/**
 * Parse the first JSON value of the expected kind out of a completion.
 * Returns undefined when nothing parseable is found.
 */
export function extractJson(raw: string, kind: "array" | "object"): unknown {
  let text = raw.replace(/^﻿/, "").trim();
  const fenced = text.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  const direct = tryParse(text);
  if (direct !== undefined && (kind === "array" ? Array.isArray(direct) : isPlainObject(direct))) return direct;

  const [open, close] = kind === "array" ? ["[", "]"] : ["{", "}"];
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end <= start) return undefined;
  const sliced = tryParse(text.slice(start, end + 1));
  if (sliced !== undefined && (kind === "array" ? Array.isArray(sliced) : isPlainObject(sliced))) return sliced;
  return undefined;
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
