// pdfjs-dist ships no type declarations for its worker entry point.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
