"use client";

import { useSyncExternalStore } from "react";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";

/**
 * The analysed result lives only in this browser tab. The original File is
 * kept in memory (for the side-by-side preview) and the result is mirrored to
 * sessionStorage so a refresh doesn't lose it. Closing the tab clears both.
 */
export interface Session {
  result: AnalysisResult;
  fileName: string;
  /** Present until the page is reloaded. */
  file: File | null;
  jd: string | null;
  /** original text -> accepted AI rewrite, applied on export. */
  accepted: Record<string, string>;
}

const KEY = "parsewise:session:v1";
let current: Session | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    if (!current) sessionStorage.removeItem(KEY);
    else {
      // The File can't be serialised; JSON.stringify drops undefined fields.
      sessionStorage.setItem(KEY, JSON.stringify({ ...current, file: undefined }));
    }
  } catch {
    // Private mode or quota: the in-memory copy still works.
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  if (current) return;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) current = { ...(JSON.parse(raw) as Omit<Session, "file">), file: null };
  } catch {
    current = null;
  }
}

export function getSession() {
  hydrate();
  return current;
}

export function setSession(next: Session | null) {
  current = next;
  persist();
  emit();
}

export function updateSession(patch: Partial<Session>) {
  if (!current) return;
  current = { ...current, ...patch };
  persist();
  emit();
}

export function acceptRewrite(original: string, replacement: string) {
  if (!current) return;
  updateSession({ accepted: { ...current.accepted, [original]: replacement } });
}

export function useSession() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSession,
    () => null,
  );
}

export async function analyzeFile(file: File, jd: string | null): Promise<AnalyzeResponse> {
  const body = new FormData();
  body.append("file", file);
  if (jd) body.append("jd", jd);
  try {
    const res = await fetch("/api/analyze", { method: "POST", body });
    return (await res.json()) as AnalyzeResponse;
  } catch {
    return { ok: false, code: "bad_request", error: "We couldn't reach the server. Check your connection and try again." };
  }
}
