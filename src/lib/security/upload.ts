import type { DocKind } from "@/lib/types";

/** 4 MB: under Vercel's 4.5 MB request-body limit, with room for multipart overhead. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadCheck =
  | { ok: true; kind: DocKind }
  | { ok: false; code: "too_large" | "bad_type"; error: string };

/**
 * Decide the document type from its magic bytes, never from the extension
 * or the client-supplied MIME type.
 *
 * PDF:  starts with "%PDF-" (allowing a little leading junk, which real PDFs have).
 * DOCX: a ZIP ("PK\x03\x04") that contains "word/document.xml". A plain ZIP or
 *       an .xlsx shares the ZIP signature, so the entry-name check matters.
 */
export function sniffUpload(buf: Uint8Array): UploadCheck {
  if (buf.byteLength === 0) {
    return { ok: false, code: "bad_type", error: "The file is empty." };
  }
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "too_large", error: "Files must be 4 MB or smaller." };
  }

  const head = new TextDecoder("latin1").decode(buf.subarray(0, 1024));
  if (head.includes("%PDF-")) return { ok: true, kind: "pdf" };

  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip) {
    // Central directory entry names are stored uncompressed, so a byte scan finds them.
    const tail = new TextDecoder("latin1").decode(buf.subarray(Math.max(0, buf.byteLength - 64 * 1024)));
    const all = tail.includes("word/document.xml") ? tail : new TextDecoder("latin1").decode(buf);
    if (all.includes("word/document.xml")) return { ok: true, kind: "docx" };
  }

  return {
    ok: false,
    code: "bad_type",
    error: "Only PDF and Word (.docx) files are supported. Older .doc files need re-saving as .docx.",
  };
}
