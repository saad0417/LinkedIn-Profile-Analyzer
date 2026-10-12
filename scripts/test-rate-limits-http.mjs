// HTTP checks of every API route's limits, size caps and guards against a
// running server (dev or prod):
//   node scripts/test-rate-limits-http.mjs [http://localhost:3000] [--llm-live]
// Each run uses fresh random client IPs (x-forwarded-for), because the server
// keeps its counters in memory. Requests are deliberately cheap (invalid bodies
// that are rejected AFTER the limiter), so nothing is parsed or sent to an LLM,
// except one real "explain" call with --llm-live.
import http from "node:http";
import { readFileSync } from "node:fs";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const LLM_LIVE = process.argv.includes("--llm-live");
const u = new URL(BASE);
const rnd = () => 1 + Math.floor(Math.random() * 250);
const NET = `198.18.${rnd()}`; // RFC 2544 benchmark range, never a real client
let hostN = 0;
const freshIp = () => `${NET}.${++hostN}`;

let fails = 0;
let passes = 0;
function check(name, cond, detail) {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL ${name}${detail !== undefined ? ` -> ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
}

/** Raw request so we control content-length / chunking exactly. */
function request(method, path, { headers = {}, body, chunked = false } = {}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const h = { ...headers };
    if (body !== undefined && !chunked && h["content-length"] === undefined) h["content-length"] = Buffer.byteLength(body);
    const req = http.request({ host: u.hostname, port: u.port, path, method, headers: h, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(buf.toString("utf8"));
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, json, bytes: buf.length, ms: Date.now() - t0 });
      });
    });
    req.on("error", (e) => (e.code === "EPIPE" || e.code === "ECONNRESET" ? resolve({ status: "reset", headers: {}, json: null, ms: Date.now() - t0 }) : reject(e)));
    if (body !== undefined) {
      if (chunked && Buffer.isBuffer(body)) {
        // Write in 64 KB pieces without a content-length (Transfer-Encoding: chunked).
        let off = 0;
        const pump = () => {
          while (off < body.length) {
            const ok = req.write(body.subarray(off, off + 65536));
            off += 65536;
            if (!ok) return req.once("drain", pump);
          }
          req.end();
        };
        pump();
        return;
      }
      req.write(body);
    }
    req.end();
  });
}

function multipart(fields) {
  const boundary = "----sec" + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [name, v] of Object.entries(fields)) {
    if (v && typeof v === "object" && "data" in v) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${v.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
      parts.push(v.data);
      parts.push(Buffer.from("\r\n"));
    } else parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), type: `multipart/form-data; boundary=${boundary}` };
}

const tinyUpload = () => multipart({ file: { name: "x.txt", data: Buffer.from("not a resume") } }); // -> 415 after the limiter
const json = (o) => JSON.stringify(o);

const ROUTES = {
  analyze: (ip, extra = {}) => {
    const m = tinyUpload();
    return request("POST", "/api/analyze", { headers: { "x-forwarded-for": ip, "content-type": m.type, ...extra }, body: m.body });
  },
  linkedin: (ip) => {
    const m = tinyUpload();
    return request("POST", "/api/linkedin/analyze", { headers: { "x-forwarded-for": ip, "content-type": m.type }, body: m.body });
  },
  match: (ip) => request("POST", "/api/match", { headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: "{}" }),
  llmLight: (ip) => request("POST", "/api/llm", { headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: json({ task: "explain" }) }),
  llmHeavy: (ip) => request("POST", "/api/llm", { headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: json({ task: "rewrite-bullets", bullets: [] }) }),
  export: (ip) => request("POST", "/api/export", { headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: "{}" }),
  exportSample: (ip) => request("GET", "/api/export?template=standard&format=pdf", { headers: { "x-forwarded-for": ip } }),
};

/** Fire `limit` requests (all must pass the limiter), then one more that must be 429. */
async function expectLimit(name, limit, ip = freshIp(), { headersOnSuccess = true } = {}) {
  const fn = ROUTES[name];
  const statuses = [];
  let first;
  for (let i = 0; i < limit; i++) {
    const r = await fn(ip);
    if (i === 0) first = r;
    statuses.push(r.status);
  }
  const over = await fn(ip);
  const passed = statuses.every((s) => s !== 429);
  check(`${name}: first ${limit} pass the limiter`, passed, statuses.join(","));
  check(`${name}: request ${limit + 1} -> 429`, over.status === 429, over.status);
  check(`${name}: 429 JSON shape`, over.json?.ok === false && over.json?.code === "rate_limited" && /try again in about \d+ (minute|hour)s?/.test(over.json?.error ?? ""), over.json);
  check(`${name}: 429 headers`, over.headers["retry-after"] && over.headers["ratelimit-limit"] === String(limit) && over.headers["ratelimit-remaining"] === "0" && over.headers["ratelimit-reset"], over.headers);
  check(`${name}: 429 no-store`, over.headers["cache-control"] === "no-store", over.headers["cache-control"]);
  if (headersOnSuccess) {
    check(`${name}: success-path RateLimit headers`, first.headers["ratelimit-limit"] === String(limit) && first.headers["ratelimit-remaining"] === String(limit - 1), {
      status: first.status,
      limit: first.headers["ratelimit-limit"],
      remaining: first.headers["ratelimit-remaining"],
    });
  }
  console.log(`  ${name.padEnd(13)} ${limit} ok, #${limit + 1} -> ${over.status}  Retry-After=${over.headers["retry-after"]}s  "${over.json?.error}"`);
  return ip;
}

async function main() {
  const ping = await request("GET", "/api/export?template=nope", {});
  if (ping.status !== 400) throw new Error(`server at ${BASE} not answering as expected (${ping.status})`);
  console.log(`server ${BASE}, test IPs ${NET}.x\n`);

  console.log("limits per route");
  const aIp = await expectLimit("analyze", 8);
  await expectLimit("linkedin", 8);
  await expectLimit("match", 60);
  const lIp = await expectLimit("llmLight", 30);
  await expectLimit("llmHeavy", 8);
  await expectLimit("export", 30);
  await expectLimit("exportSample", 60, freshIp(), { headersOnSuccess: false });

  console.log("\nisolation");
  for (const other of ["linkedin", "match", "llmLight", "export", "exportSample"]) {
    const r = await ROUTES[other](aIp);
    check(`analyze exhausted, ${other} still open for same IP`, r.status !== 429, r.status);
  }
  const heavyAfterLight = await ROUTES.llmHeavy(lIp);
  check("llm light exhausted, heavy bucket still open", heavyAfterLight.status !== 429, heavyAfterLight.status);
  const otherIp = await ROUTES.analyze(freshIp());
  check("analyze exhausted for one IP, another IP unaffected", otherIp.status !== 429, otherIp.status);
  console.log("  done");

  console.log("\nclient IP handling");
  {
    const p64 = `2001:db8:${rnd().toString(16)}:${rnd().toString(16)}`;
    const st = [];
    for (let i = 1; i <= 9; i++) st.push((await ROUTES.analyze(`${p64}:${i.toString(16)}::${(i * 7).toString(16)}`)).status);
    check("IPv6: 9 addresses in one /64 share a bucket (9th -> 429)", st.slice(0, 8).every((s) => s !== 429) && st[8] === 429, st.join(","));
    const v = freshIp();
    const st2 = [];
    for (let i = 0; i < 9; i++) st2.push((await ROUTES.analyze("10.0.0.1", { "x-vercel-forwarded-for": v })).status);
    check("x-vercel-forwarded-for wins over x-forwarded-for", st2[8] === 429, st2.join(","));
    const st3 = (await ROUTES.analyze("10.0.0.1", { "x-vercel-forwarded-for": freshIp() })).status;
    check("…and a new x-vercel-forwarded-for is a new bucket", st3 !== 429, st3);
    console.log(`  /64 statuses ${st.join(",")}`);
  }

  console.log("\nrequest size caps");
  {
    const ip = freshIp();
    const r1 = await request("POST", "/api/analyze", { headers: { "x-forwarded-for": ip, "content-type": "multipart/form-data; boundary=x", "content-length": String(8 * 1024 * 1024) }, body: "" });
    check("analyze: declared 8 MB -> 413 before reading", r1.status === 413 && r1.json?.code === "too_large", r1);
    const big = multipart({ file: { name: "big.pdf", data: Buffer.alloc(6 * 1024 * 1024, 0x25) } });
    const r2 = await request("POST", "/api/analyze", { headers: { "x-forwarded-for": ip, "content-type": big.type }, body: big.body, chunked: true });
    check("analyze: 6 MB chunked (no content-length) -> 413", r2.status === 413 && r2.json?.code === "too_large", { status: r2.status, json: r2.json });
    const r3 = await request("POST", "/api/llm", { headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: Buffer.from(json({ task: "explain", pad: "x".repeat(300_000) })), chunked: true });
    check("llm: 300 KB chunked JSON -> 413", r3.status === 413, { status: r3.status, json: r3.json });
    const r4 = await request("POST", "/api/match", { headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: Buffer.alloc(2_000_000, 0x20), chunked: true });
    check("match: 2 MB chunked -> 413", r4.status === 413, r4.status);
    const r5 = await request("POST", "/api/export", { headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: Buffer.alloc(400_000, 0x20), chunked: true });
    check("export: 400 KB chunked -> 413", r5.status === 413, r5.status);
    const r6 = await request("POST", "/api/linkedin/analyze", { headers: { "x-forwarded-for": ip, "content-type": big.type }, body: big.body, chunked: true });
    check("linkedin: 6 MB chunked -> 413", r6.status === 413, r6.status);
    console.log(`  413s in ${[r1, r2, r3, r4, r5, r6].map((r) => r.ms + "ms").join(", ")}`);
  }

  console.log("\nmalicious files");
  {
    const bomb = readFileSync(new URL("../.scratch/sec/bomb.docx", import.meta.url));
    const m = multipart({ file: { name: "bomb.docx", data: bomb } });
    const r = await request("POST", "/api/analyze", { headers: { "x-forwarded-for": freshIp(), "content-type": m.type }, body: m.body });
    check("zip bomb (200 KB -> 200 MB) -> 422 unreadable", r.status === 422 && r.json?.code === "unreadable" && /unusually large/.test(r.json?.error), r.json);
    check("zip bomb rejected fast", r.ms < 3000, r.ms);
    console.log(`  zip bomb: ${r.status} in ${r.ms} ms: "${r.json?.error}"`);
    const pdf = readFileSync(new URL("../.scratch/sec/pages40.pdf", import.meta.url));
    const m2 = multipart({ file: { name: "long.pdf", data: pdf } });
    const r2 = await request("POST", "/api/analyze", { headers: { "x-forwarded-for": freshIp(), "content-type": m2.type }, body: m2.body });
    check("40-page PDF analysed (first 15 pages) with real page count", r2.status === 200 && r2.json?.result?.document?.pageCount === 40, { status: r2.status, pages: r2.json?.result?.document?.pageCount });
    console.log(`  40-page PDF: ${r2.status} in ${r2.ms} ms`);
  }

  console.log("\ncross-site requests");
  {
    const ip = freshIp();
    const m = tinyUpload();
    const r1 = await request("POST", "/api/analyze", { headers: { "x-forwarded-for": ip, "content-type": m.type, "sec-fetch-site": "cross-site", origin: "https://evil.example" }, body: m.body });
    check("cross-site upload -> 403", r1.status === 403, r1.status);
    const r2 = await request("POST", "/api/llm", { headers: { "x-forwarded-for": ip, "content-type": "application/json", origin: "https://evil.example" }, body: json({ task: "explain" }) });
    check("foreign Origin to /api/llm -> 403", r2.status === 403, r2.status);
    const r3 = await request("POST", "/api/match", { headers: { "x-forwarded-for": ip, "content-type": "application/json", "sec-fetch-site": "same-origin" }, body: "{}" });
    check("same-origin -> passes", r3.status === 400, r3.status);
    const r4 = await ROUTES.analyze(ip);
    check("cross-site attempts did not consume the victim IP's quota", r4.headers["ratelimit-remaining"] === "7", r4.headers["ratelimit-remaining"]);
    console.log("  done");
  }

  if (LLM_LIVE) {
    console.log("\nlive LLM (one explain call)");
    const r = await request("POST", "/api/llm", {
      headers: { "x-forwarded-for": freshIp(), "content-type": "application/json" },
      body: json({ task: "explain", checkId: "c.quantified", title: "Quantified results", summary: "Few bullets include numbers." }),
    });
    check("valid explain -> 200 or 503 with RateLimit headers", (r.status === 200 || r.status === 503) && r.headers["ratelimit-limit"] === "30", { status: r.status, h: r.headers["ratelimit-limit"] });
    console.log(`  ${r.status} in ${r.ms} ms, RateLimit-Remaining=${r.headers["ratelimit-remaining"]}`);
  }

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
