"use client";

import { useSyncExternalStore } from "react";
import type { ResumeContent, TemplateId } from "@/lib/types";

/**
 * The resume being built or improved. Kept in this browser's localStorage so a
 * long form survives a closed tab; never sent anywhere except to generate a
 * file or an AI suggestion on request. "Start over" clears it.
 */
export interface Draft {
  content: ResumeContent;
  template: TemplateId;
  targetRole: string;
  jobDescription: string;
  source: "improve" | "scratch" | "template";
  /** The score of the original upload, to compare against after rebuilding. */
  baseline: { ats: number; fileName: string } | null;
  updatedAt: number;
}

const KEY = "parsewise:draft:v1";
let current: Draft | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

export function emptyContent(): ResumeContent {
  return {
    name: "",
    headline: null,
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    links: [],
    summary: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
  };
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = JSON.parse(raw) as Draft;
  } catch {
    current = null;
  }
}

function persist() {
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the in-memory draft still works for this visit.
  }
}

export function getDraft() {
  hydrate();
  return current;
}

export function setDraft(next: Draft | null) {
  current = next ? { ...next, updatedAt: Date.now() } : null;
  persist();
  for (const l of listeners) l();
}

export function patchDraft(patch: Partial<Draft>) {
  const d = getDraft();
  if (d) setDraft({ ...d, ...patch });
}

export function useDraft() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getDraft,
    () => null,
  );
}
