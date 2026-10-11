"use client";

import { useSyncExternalStore } from "react";
import type { LinkedInAnalysis, LinkedInAnalyzeResponse, LinkedInReview } from "@/lib/linkedin/types";

/** LinkedIn results live only in this tab (sessionStorage), like resume results. */
export interface LinkedInSession {
  result: LinkedInAnalysis;
  fileName: string;
  review: LinkedInReview | null;
}

const KEY = "parsewise:linkedin:v1";
let current: LinkedInSession | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) current = JSON.parse(raw) as LinkedInSession;
  } catch {
    current = null;
  }
}

export function getLinkedIn() {
  hydrate();
  return current;
}

export function setLinkedIn(next: LinkedInSession | null) {
  current = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch {
    // ignore: in-memory copy still works
  }
  for (const l of listeners) l();
}

export function useLinkedIn() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLinkedIn,
    () => null,
  );
}

export async function analyzeLinkedInFile(file: File): Promise<LinkedInAnalyzeResponse> {
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/linkedin/analyze", { method: "POST", body });
    return (await res.json()) as LinkedInAnalyzeResponse;
  } catch {
    return { ok: false, code: "bad_request", error: "We couldn't reach the server. Check your connection and try again." };
  }
}
