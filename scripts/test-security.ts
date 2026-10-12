// Unit tests for the security helpers (no dev server needed):
//   npx tsx scripts/test-security.ts
// Covers client-IP parsing, the rate limiter (memory + an Upstash-compatible
// mock over HTTP, incl. Redis failure modes), capped body reading, the DOCX
// zip-bomb guard and the PDF page/time limits. Exit code 1 on any failure.
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[k];

import {
  LIMITS,
  clientIp,
  expireMemoryWindowForTesting,
  limitMessage,
  normaliseIp,
  rateLimit,
  rateLimitBackend,
  resetMemoryStoreForTesting,
  setRateLimitStoreForTesting,
} from "../src/lib/security/rate-limit";
import { isCrossSite, readBodyCapped } from "../src/lib/security/request";
import { assertSafeZip, UnsafeZipError } from "../src/lib/security/zip-guard";
import { analyzeDocument, UnreadableDocumentError } from "../src/lib/analyze";

const ROOT = resolve(__dirname, "..");
let failures = 0;
let passes = 0;
function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) passes++;
  else {
    failures++;
    console.log(`FAIL ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  }
}
const section = (s: string) => console.log(`\n== ${s}`);

async function main() {
  /* ---------------- client IP ---------------- */
  section("client IP");
  const ipCases: [string | null, string | null][] = [
    ["203.0.113.7", "203.0.113.7"],
    [" 203.0.113.7 ", "203.0.113.7"],
    ["203.0.113.7:51234", "203.0.113.7"],
    ["::ffff:198.51.100.4", "198.51.100.4"],
    ["[2001:db8:abcd:12:1:2:3:4]:443", "2001:db8:abcd:12::/64"],
    ["2001:db8:abcd:12:ffff:ffff:ffff:ffff", "2001:db8:abcd:12::/64"],
    ["2001:DB8:ABCD:0012::1", "2001:db8:abcd:12::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    ["999.1.1.1", null],
    ["not-an-ip", null],
    ["1:2:3:4:5:6:7:8:9", null],
    ["", null],
    [null, null],
  ];
  for (const [input, want] of ipCases) check(`normaliseIp(${input})`, normaliseIp(input) === want, normaliseIp(input));

  const h = (o: Record<string, string>) => new Headers(o);
  check("prefers x-vercel-forwarded-for", clientIp(h({ "x-vercel-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2", "x-forwarded-for": "198.51.100.3" })) === "198.51.100.1");
  check("then x-real-ip", clientIp(h({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "198.51.100.3" })) === "198.51.100.2");
  check("then FIRST x-forwarded-for", clientIp(h({ "x-forwarded-for": "198.51.100.3, 10.0.0.1, 10.0.0.2" })) === "198.51.100.3");
  check("garbage header falls through", clientIp(h({ "x-real-ip": "garbage", "x-forwarded-for": "198.51.100.9" })) === "198.51.100.9");
  check("no headers -> unknown", clientIp(h({})) === "unknown");
  check("ipv6 rotation within /64 shares a key",
    clientIp(h({ "x-forwarded-for": "2001:db8:1:2::aaaa" })) === clientIp(h({ "x-forwarded-for": "2001:db8:1:2:ffff::1" })));

  /* ---------------- rate limiter (memory) ---------------- */
  section("rate limiter: memory");
  setRateLimitStoreForTesting("memory");
  resetMemoryStoreForTesting();
  check("backend is memory", rateLimitBackend() === "memory");

  const ip = "198.51.100.10";
  const seen: { ok: boolean; rem: number; h: Record<string, string> }[] = [];
  for (let i = 0; i < 9; i++) {
    const d = await rateLimit("analyze", ip);
    seen.push({ ok: d.ok, rem: d.remaining, h: d.headers });
  }
  check("analyze: 8 allowed", seen.slice(0, 8).every((s) => s.ok), seen.map((s) => s.ok));
  check("analyze: 9th refused", !seen[8].ok);
  check("analyze: remaining counts down 7..0", seen.slice(0, 8).map((s) => s.rem).join() === "7,6,5,4,3,2,1,0", seen.map((s) => s.rem));
  check("analyze: headers on success", seen[0].h["RateLimit-Limit"] === "8" && seen[0].h["RateLimit-Reset"] && seen[0].h["RateLimit-Policy"] === "8;w=600, 30;w=86400", seen[0].h);
  const refused = seen[8].h;
  check("analyze: Retry-After ≈ 600s", Number(refused["Retry-After"]) > 590 && Number(refused["Retry-After"]) <= 600, refused);
  check("analyze: refused remaining 0", refused["RateLimit-Remaining"] === "0");
  const blocked = await rateLimit("analyze", ip);
  check("analyze: message mentions 10 minutes", /8 resume checks in 10 minutes\. You can try again in about 10 minutes\./.test(limitMessage("analyze", blocked)), limitMessage("analyze", blocked));

  check("other routes unaffected by analyze", (await rateLimit("linkedin", ip)).ok && (await rateLimit("match", ip)).ok && (await rateLimit("export", ip)).ok);
  check("other IPs unaffected", (await rateLimit("analyze", "198.51.100.11")).ok);

  // Daily window: simulate 30 over time by using a fresh IP and resetting only the 10-minute bucket.
  {
    const dip = "198.51.100.12";
    let last;
    for (let i = 0; i < 30; i++) {
      last = await rateLimit("analyze", dip);
      if (!last.ok) resetBucket("analyze-10m", dip);
      if (i % 8 === 7) resetBucket("analyze-10m", dip);
    }
    check("analyze: 30th of the day allowed", last!.ok, last);
    const d31 = await rateLimit("analyze", dip);
    check("analyze: 31st of the day refused (day window)", !d31.ok && d31.blockedLabel === "today" && d31.limit === 30, d31);
    check("analyze: day message in hours", /30 resume checks today\. You can try again in about 24 hours\./.test(limitMessage("analyze", d31)), limitMessage("analyze", d31));
  }

  // LLM: light 30/h, heavy 8/h, shared 40/day.
  {
    const lip = "198.51.100.20";
    let okHeavy = 0;
    for (let i = 0; i < 10; i++) if ((await rateLimit("llmHeavy", lip)).ok) okHeavy++;
    check("llm heavy: 8 per hour", okHeavy === 8, okHeavy);
    check("llm light still open after heavy exhausted", (await rateLimit("llmLight", lip)).ok);
    const lip2 = "198.51.100.21";
    let okLight = 0;
    for (let i = 0; i < 32; i++) if ((await rateLimit("llmLight", lip2)).ok) okLight++;
    check("llm light: 30 per hour", okLight === 30, okLight);
    // Shared day bucket: 2 + 30 (light, incl. refused) already counted for lip2 today.
    const lip3 = "198.51.100.22";
    let n = 0;
    for (let i = 0; i < 70; i++) {
      const d = await rateLimit(i % 2 ? "llmHeavy" : "llmLight", lip3);
      if (d.ok) n++;
      resetBucket("llm-light-1h", lip3);
      resetBucket("llm-heavy-1h", lip3);
    }
    check("llm: shared 40/day across light+heavy", n === 40, n);
  }

  // Unknown IP: one shared bucket at half the limits.
  {
    let ok = 0;
    for (let i = 0; i < 6; i++) if ((await rateLimit("analyze", "unknown")).ok) ok++;
    check("unknown IP: stricter shared bucket (4 per 10 min)", ok === 4, ok);
  }

  // Global ceiling: one counter for everyone.
  {
    const ceiling = LIMITS.llmGlobal.windows[0].limit;
    let ok = 0;
    for (let i = 0; i < ceiling + 2; i++) if ((await rateLimit("llmGlobal", `203.0.113.${i % 250}`)).ok) ok++;
    check(`llm global: ${ceiling}/day across all IPs`, ok === ceiling, ok);
  }

  /* ---------------- rate limiter (Upstash mock) ---------------- */
  section("rate limiter: Upstash REST (mock)");
  const mock = await startMockUpstash("test-token");
  setRateLimitStoreForTesting({ url: mock.url, token: "test-token" });
  check("backend is redis", rateLimitBackend() === "redis");
  {
    const rip = "198.51.100.30";
    const res = [];
    for (let i = 0; i < 9; i++) res.push(await rateLimit("analyze", rip));
    check("redis: 8 allowed then refused", res.slice(0, 8).every((d) => d.ok) && !res[8].ok, res.map((d) => d.ok));
    check("redis: Retry-After from PTTL", Number(res[8].headers["Retry-After"]) > 590, res[8].headers);
    check("redis: counters live in redis, not memory", mock.keys().some((k) => k === `rl:v1:analyze-10m:${rip}`));
    check("redis: keys carry a TTL", mock.ttl(`rl:v1:analyze-10m:${rip}`) > 0 && mock.ttl(`rl:v1:analyze-day:${rip}`) > 590_000);
    resetMemoryStoreForTesting(); // a "new instance": memory is empty, redis still remembers
    check("redis: shared across instances", !(await rateLimit("analyze", rip)).ok);
  }
  // Wrong token -> treated as an outage.
  section("rate limiter: Redis failure modes");
  setRateLimitStoreForTesting({ url: mock.url, token: "wrong" });
  {
    const fip = "198.51.100.40";
    let ok = 0;
    for (let i = 0; i < 10; i++) if ((await rateLimit("analyze", fip)).ok) ok++;
    check("redis down: expensive route falls back to memory (8 allowed, not unlimited)", ok === 8, ok);
    let okm = 0;
    for (let i = 0; i < 70; i++) if ((await rateLimit("match", fip)).ok) okm++;
    check("redis down: cheap route fails open", okm === 70, okm);
  }
  setRateLimitStoreForTesting({ url: "http://127.0.0.1:9", token: "x" }); // nothing listens
  {
    const t0 = Date.now();
    const d = await rateLimit("export", "198.51.100.41");
    check("redis unreachable: falls back quickly", d.ok && Date.now() - t0 < 1500, Date.now() - t0);
  }
  await mock.close();
  setRateLimitStoreForTesting(null);

  /* ---------------- request guards ---------------- */
  section("request guards");
  const req = (headers: Record<string, string>, body?: BodyInit) =>
    new Request("http://localhost:3000/api/x", { method: "POST", headers, body, duplex: "half" } as RequestInit);
  check("same-origin allowed", !isCrossSite(req({ "sec-fetch-site": "same-origin", host: "localhost:3000" })));
  check("cross-site refused", isCrossSite(req({ "sec-fetch-site": "cross-site", host: "localhost:3000" })));
  check("same-site refused", isCrossSite(req({ "sec-fetch-site": "same-site", host: "localhost:3000" })));
  check("curl (no headers) allowed", !isCrossSite(req({ host: "localhost:3000" })));
  check("matching Origin allowed", !isCrossSite(req({ origin: "http://localhost:3000", host: "localhost:3000" })));
  check("foreign Origin refused", isCrossSite(req({ origin: "https://evil.example", host: "localhost:3000" })));
  check("Origin null refused", isCrossSite(req({ origin: "null", host: "localhost:3000" })));

  const chunked = (n: number, size: number) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < n; i++) c.enqueue(new Uint8Array(size));
        c.close();
      },
    });
  check("capped read: declared too large", (await readBodyCapped(req({ "content-length": "999999" }, "x"), 1000)).ok === false);
  const r1 = await readBodyCapped(req({}, chunked(100, 1024)), 50_000);
  check("capped read: chunked body over cap refused", !r1.ok && r1.reason === "too_large", r1);
  const r2 = await readBodyCapped(req({}, chunked(10, 1024)), 50_000);
  check("capped read: small chunked body ok", r2.ok && r2.bytes.byteLength === 10240);

  /* ---------------- zip guard ---------------- */
  section("zip guard");
  const okDocx = readFileSync(join(ROOT, "fixtures", "01-clean-software-us.docx"));
  check("real docx passes", noThrow(() => assertSafeZip(okDocx)));
  for (const f of ["05-sidebar-two-column-au.docx", "09-text-boxes.docx", "17-skill-bars.docx", "export-technical.docx"]) {
    check(`fixture ${f} passes`, noThrow(() => assertSafeZip(readFileSync(join(ROOT, "fixtures", f)))));
  }

  const bomb = await docxWith({ "word/document.xml": Buffer.alloc(200 * 1024 * 1024, 0x20) });
  console.log(`   bomb: ${(bomb.byteLength / 1024).toFixed(0)} KB compressed -> 200 MB`);
  let t0 = Date.now();
  check("zip bomb rejected", await throwsUnsafe(() => assertSafeZip(bomb), "too large"));
  check("zip bomb rejected fast (< 1 s)", Date.now() - t0 < 1000, Date.now() - t0);

  const spread = await docxWith(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`word/media/p${i}.bin`, Buffer.alloc(1024 * 1024, 7)])));
  check("many medium entries over 25 MB total rejected", await throwsUnsafe(() => assertSafeZip(spread), "too large"));

  const many = await docxWith(Object.fromEntries(Array.from({ length: 1200 }, (_, i) => [`x/${i}.txt`, "a"])));
  check("too many entries rejected", await throwsUnsafe(() => assertSafeZip(many), "too many entries"));

  const laughs = `<?xml version="1.0"?><!-- pad ${"x".repeat(10000)} --><!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]><w:document>&b;</w:document>`;
  check("DOCTYPE/ENTITY in XML rejected", await throwsUnsafe(async () => assertSafeZip(await docxWith({ "word/document.xml": laughs })), "xml doctype"));
  check("DOCTYPE in UTF-16 rejected", await throwsUnsafe(async () => assertSafeZip(await docxWith({ "word/styles.xml": Buffer.from(laughs, "utf16le") })), "xml doctype"));

  // Lying header: central directory says 100 bytes, data really inflates to 60 MB.
  const liar = lyingZip("word/document.xml", Buffer.alloc(60 * 1024 * 1024, 0x41), 100);
  check("lying size header rejected (real size is what counts)", await throwsUnsafe(() => assertSafeZip(liar), "too large"));
  check("garbage is not a zip", await throwsUnsafe(() => assertSafeZip(Buffer.from("PK\x03\x04 not really a zip")), ""));

  t0 = Date.now();
  const viaEngine = await analyzeDocument(new Uint8Array(bomb), "docx").then(() => "ok", (e) => e);
  check("engine maps bomb to UnreadableDocumentError", viaEngine instanceof UnreadableDocumentError && /unusually large/.test(viaEngine.message), String(viaEngine));
  check("engine rejects bomb fast", Date.now() - t0 < 1500, Date.now() - t0);

  /* ---------------- PDF limits ---------------- */
  section("PDF limits");
  const pdf40 = await manyPagePdf(40);
  t0 = Date.now();
  const r40 = await analyzeDocument(pdf40, "pdf");
  const maxPage = Math.max(...[...r40.rawText.matchAll(/Page (\d+) Experience/g)].map((m) => Number(m[1])));
  check("40-page PDF: only first 15 pages read", maxPage === 15, maxPage);
  check("40-page PDF: page count still reported", r40.document.pageCount === 40, r40.document.pageCount);
  console.log(`   40-page PDF analysed in ${Date.now() - t0} ms`);

  // Deadline wiring: make the clock jump 20 s after parsing starts.
  const realNow = Date.now;
  let calls = 0;
  Date.now = () => realNow() + (++calls > 3 ? 20_000 : 0);
  const slow = await analyzeDocument(await manyPagePdf(3), "pdf").then(() => "ok", (e) => e);
  Date.now = realNow;
  check("time budget exceeded -> UnreadableDocumentError", slow instanceof UnreadableDocumentError && /too complex/.test(slow.message), String(slow));

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

/* ---------------- helpers ---------------- */

function resetBucket(bucket: string, ip: string) {
  expireMemoryWindowForTesting(bucket, ip);
}

function noThrow(fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch (e) {
    console.log("   unexpected:", (e as Error).message);
    return false;
  }
}

async function throwsUnsafe(fn: () => unknown, reason: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof UnsafeZipError && e.reason.includes(reason);
  }
}

async function docxWith(extra: Record<string, string | Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types/>`);
  if (!("word/document.xml" in extra)) zip.file("word/document.xml", `<?xml version="1.0"?><w:document/>`);
  for (const [k, v] of Object.entries(extra)) zip.file(k, v);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

/** A single-entry zip whose headers claim `claimed` uncompressed bytes. */
function lyingZip(name: string, data: Buffer, claimed: number): Buffer {
  const comp = deflateRawSync(data, { level: 9 });
  const nameB = Buffer.from(name);
  const loc = Buffer.alloc(30);
  loc.writeUInt32LE(0x04034b50, 0);
  loc.writeUInt16LE(20, 4);
  loc.writeUInt16LE(8, 8);
  loc.writeUInt32LE(comp.length, 18);
  loc.writeUInt32LE(claimed, 22);
  loc.writeUInt16LE(nameB.length, 26);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(comp.length, 20);
  cen.writeUInt32LE(claimed, 24);
  cen.writeUInt16LE(nameB.length, 28);
  cen.writeUInt32LE(0, 42);
  const cdOffset = loc.length + nameB.length + comp.length;
  const cdSize = cen.length + nameB.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([loc, nameB, comp, cen, nameB, eocd]);
}

async function manyPagePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([612, 792]);
    p.drawText(`Page ${i} Experience Senior Engineer at Example Corp 2019 - 2024`, { x: 50, y: 700, size: 11, font });
    p.drawText(`Led a team of five engineers and shipped features to customers on page ${i}.`, { x: 50, y: 680, size: 11, font });
  }
  return doc.save();
}

interface MockRedis {
  url: string;
  keys(): string[];
  ttl(k: string): number;
  close(): Promise<void>;
}

/** Just enough of Upstash's REST /multi-exec for SET … PX … NX, INCR and PTTL. */
function startMockUpstash(token: string): Promise<MockRedis> {
  const data = new Map<string, { v: number; exp: number }>();
  const live = (k: string) => {
    const e = data.get(k);
    if (e && e.exp <= Date.now()) data.delete(k);
    return data.get(k);
  };
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.headers.authorization !== `Bearer ${token}`) {
        res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      if (req.url !== "/multi-exec") {
        res.writeHead(404).end();
        return;
      }
      const cmds = JSON.parse(body) as string[][];
      const out = cmds.map(([cmd, k, ...a]) => {
        switch (cmd.toUpperCase()) {
          case "SET": {
            if (a.includes("NX") && live(k)) return { result: null };
            const px = a.indexOf("PX");
            data.set(k, { v: Number(a[0]), exp: px >= 0 ? Date.now() + Number(a[px + 1]) : Infinity });
            return { result: "OK" };
          }
          case "INCR": {
            const e = live(k) ?? { v: 0, exp: Infinity };
            e.v += 1;
            data.set(k, e);
            return { result: e.v };
          }
          case "PTTL": {
            const e = live(k);
            return { result: !e ? -2 : e.exp === Infinity ? -1 : e.exp - Date.now() };
          }
          default:
            return { error: "ERR unknown command" };
        }
      });
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
    });
  });
  return new Promise((r) =>
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      r({
        url: `http://127.0.0.1:${port}`,
        keys: () => [...data.keys()],
        ttl: (k) => (live(k) ? live(k)!.exp - Date.now() : -2),
        close: () => new Promise((c) => server.close(() => c())),
      });
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
