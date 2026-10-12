import { inflateRawSync } from "node:zlib";

/**
 * Zip-bomb / XML-bomb guard for uploaded DOCX files, run BEFORE jszip or
 * mammoth touch the archive.
 *
 * A 5 MB upload can declare (or really contain) gigabytes of compressed XML.
 * jszip trusts nothing but also limits nothing, and mammoth inflates every
 * part it reads, so this pass:
 *  1. reads the central directory itself (same "last end-of-central-directory
 *     record" rule jszip uses) and rejects too many entries, ZIP64, encrypted
 *     entries and compression methods other than stored/deflate;
 *  2. really inflates every entry with zlib's `maxOutputLength`, so a header
 *     that lies about sizes can't sneak past: the TRUE total is capped;
 *  3. rejects XML parts with a DOCTYPE/ENTITY declaration (Word never writes
 *     one; it's how "billion laughs" entity expansion starts).
 * Inflating ≤ 25 MB costs tens of milliseconds, and once it passes, every
 * later decompression of the same archive is bounded too.
 */
export const ZIP_LIMITS = {
  entries: 1000,
  /** Total uncompressed bytes across all entries. */
  totalBytes: 25 * 1024 * 1024,
  /** Any single XML part (document.xml of a long resume is well under 1 MB). */
  xmlBytes: 10 * 1024 * 1024,
} as const;

export class UnsafeZipError extends Error {
  constructor(readonly reason: string) {
    super(`unsafe zip: ${reason}`);
    this.name = "UnsafeZipError";
  }
}

/** "<!DOCTYPE" / "<!ENTITY" in UTF-8 and UTF-16LE. */
const DTD_MARKERS = ["<!DOCTYPE", "<!ENTITY"].flatMap((s) => [Buffer.from(s, "utf8"), Buffer.from(s, "utf16le")]);

function fail(reason: string): never {
  throw new UnsafeZipError(reason);
}

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

export function assertSafeZip(buf: Uint8Array, limits: typeof ZIP_LIMITS = ZIP_LIMITS): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => view.getUint16(o, true);
  const u32 = (o: number) => view.getUint32(o, true);

  // End of central directory: the LAST signature within the final 64 KiB + 22 bytes.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 0xffff); i--) {
    if (u32(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("no end of central directory");

  const entries = u16(eocd + 10);
  const cdSize = u32(eocd + 12);
  const cdOffset = u32(eocd + 16);
  if (entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) fail("zip64");
  if (entries > limits.entries) fail("too many entries");
  if (cdOffset + cdSize > buf.byteLength) fail("central directory out of range");

  let total = 0;
  let p = cdOffset;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > buf.byteLength || u32(p) !== SIG_CEN) fail("bad central directory");
    const flags = u16(p + 8);
    const method = u16(p + 10);
    const compSize = u32(p + 20);
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    const localOffset = u32(p + 42);
    const name = new TextDecoder("latin1").decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x1) fail("encrypted entry");
    if (method !== 0 && method !== 8) fail("unsupported compression");
    if (localOffset + 30 > buf.byteLength || u32(localOffset) !== SIG_LOC) fail("bad local header");
    const dataStart = localOffset + 30 + u16(localOffset + 26) + u16(localOffset + 28);
    if (dataStart + compSize > buf.byteLength) fail("entry out of range");
    if (name.endsWith("/") && compSize === 0) continue; // directory

    const compressed = buf.subarray(dataStart, dataStart + compSize);
    const isXml = /\.(xml|rels)$/i.test(name);
    const room = Math.min(limits.totalBytes - total, isXml ? limits.xmlBytes : Infinity);
    let out: Uint8Array;
    if (method === 0) {
      if (compressed.byteLength > room) fail("too large when uncompressed");
      out = compressed;
    } else {
      try {
        // maxOutputLength must be ≥ 1; throws RangeError once the real output would exceed it.
        out = inflateRawSync(compressed, { maxOutputLength: Math.max(1, room) });
      } catch (e) {
        fail(e instanceof RangeError ? "too large when uncompressed" : "corrupt entry");
      }
    }
    total += out.byteLength;
    if (total > limits.totalBytes) fail("too large when uncompressed");

    if (isXml) {
      // Byte search over the whole part (comments can push a DOCTYPE past any fixed prefix).
      const b = Buffer.from(out.buffer, out.byteOffset, out.byteLength);
      if (DTD_MARKERS.some((m) => b.includes(m))) fail("xml doctype");
    }
  }
}
