"use client";

import type { AnalyzeResponse, LLMResponse, LLMTask, ResumeContent, TemplateId } from "@/lib/types";

export async function callLlm(task: LLMTask): Promise<LLMResponse> {
  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    return (await res.json()) as LLMResponse;
  } catch {
    return { ok: false, code: "unavailable", error: "We couldn't reach the server. Try again in a moment." };
  }
}

export interface ExportedFile {
  blob: Blob;
  name: string;
}

export async function exportResume(
  content: ResumeContent,
  template: TemplateId,
  format: "docx" | "pdf",
): Promise<ExportedFile> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, template, format }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "The file couldn't be built. Please try again.");
  }
  const blob = await res.blob();
  const name =
    /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `resume.${format}`;
  return { blob, name };
}

export function saveFile({ blob, name }: ExportedFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Run a generated file back through the same checker the user's upload went through. */
export async function recheck(file: ExportedFile, jd: string | null): Promise<AnalyzeResponse> {
  const body = new FormData();
  body.append("file", new File([file.blob], file.name));
  if (jd) body.append("jd", jd);
  try {
    const res = await fetch("/api/analyze", { method: "POST", body });
    return (await res.json()) as AnalyzeResponse;
  } catch {
    return { ok: false, code: "bad_request", error: "We couldn't reach the server. Try again in a moment." };
  }
}
