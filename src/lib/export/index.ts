import type { ResumeContent, TemplateId } from "@/lib/types";
import { renderDocx } from "./docx";
import { renderPdf } from "./pdf";
import type { ExportFormat } from "./validate";

export { profileToResumeContent, normalizeDate, normalizeRange, formatRange } from "./content";
export * from "./sample";
export { TEMPLATES, TEMPLATE_IDS, TEMPLATE_LIST, SECTION_HEADINGS, isTemplateId, getTemplate } from "./templates";
export { TEMPLATES as TEMPLATE_META, CATEGORY_LABEL, type TemplateMeta, type TemplateCategory } from "./registry";
export { buildBlocks, buildDocument, groupSkills, normalizeContent, resumeFileName } from "./layout";
export { parseExportRequest, parseResumeContent, isFormat, EXPORT_LIMITS, type ExportFormat } from "./validate";
export { renderDocx, renderPdf };

export const MIME: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export function renderResume(content: ResumeContent, template: TemplateId, format: ExportFormat): Promise<Uint8Array> {
  return format === "pdf" ? renderPdf(content, template) : renderDocx(content, template);
}
