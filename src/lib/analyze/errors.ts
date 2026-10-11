/**
 * Thrown when a file cannot be opened at all (corrupt, password-protected,
 * not really a PDF/DOCX). `message` is safe to show to the user and never
 * contains document content.
 */
export class UnreadableDocumentError extends Error {
  readonly reason: "encrypted" | "corrupt";

  constructor(reason: "encrypted" | "corrupt", message?: string) {
    super(
      message ??
        (reason === "encrypted"
          ? "This file is password-protected. Remove the password and upload it again."
          : "We could not open this file. It may be damaged or saved in an unusual format. Try exporting it again from Word or Google Docs."),
    );
    this.name = "UnreadableDocumentError";
    this.reason = reason;
  }
}
