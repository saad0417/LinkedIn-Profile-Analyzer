// Minimal PNG encoder for fixture generation (solid shapes only).
import { deflateSync, crc32 } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

/** Encode an RGBA pixel callback into a PNG. */
export function png(width: number, height: number, px: (x: number, y: number) => [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = px(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A horizontal "skill bar": filled portion in accent colour, rest grey. */
export function skillBar(fraction: number): Buffer {
  const w = 200, h = 16;
  return png(w, h, (x) => (x < w * fraction ? [37, 99, 235, 255] : [220, 220, 220, 255]));
}

/** A small round icon (e.g. phone/email/location glyph stand-in). */
export function icon(r: number, g: number, b: number): Buffer {
  const s = 32;
  return png(s, s, (x, y) => {
    const d = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5);
    return d < s / 2 - 1 ? [r, g, b, 255] : [255, 255, 255, 0];
  });
}

/** A placeholder headshot (soft gradient circle). */
export function headshot(): Buffer {
  const s = 160;
  return png(s, s, (x, y) => {
    const d = Math.hypot(x - s / 2, y - s / 2);
    if (d > s / 2 - 1) return [255, 255, 255, 0];
    return [120 + Math.round(x / 3), 140, 160 + Math.round(y / 4), 255];
  });
}
