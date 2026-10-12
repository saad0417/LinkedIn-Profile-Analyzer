// Calls the real /api/llm route handler in-process with a fake provider (no
// network) to prove the order of checks around the GLOBAL daily ceiling:
//   npx tsx scripts/test-llm-route.ts
// - invalid requests and "no provider configured" never consume the ceiling;
// - each valid request consumes exactly one unit;
// - once the ceiling is reached, users get 429 daily_limit and the provider isn't called.
for (const k of ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[k];
process.env.LLM_DAILY_CEILING = "5";

// Imports are dynamic (in main) so the env above is set before the modules read it.
let POST: typeof import("../src/app/api/llm/route").POST;
let setProviderForTesting: typeof import("../src/lib/llm").setProviderForTesting;
let rateLimit: typeof import("../src/lib/security/rate-limit").rateLimit;

let fails = 0;
const check = (name: string, cond: unknown, detail?: unknown) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${!cond && detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  if (!cond) fails++;
};

let n = 0;
const call = (body: unknown, ip = `198.51.100.${++n}`) =>
  POST(new Request("http://localhost:3000/api/llm", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

/** Global units left. Probing costs one unit itself, so callers compare consecutive probes (expected delta 1). */
const globalLeft = async () => (await rateLimit("llmGlobal", "global")).remaining;

const valid = { task: "explain", checkId: "c.quantified", title: "Quantified results", summary: "Few bullets include numbers." };

async function main() {
  ({ POST } = await import("../src/app/api/llm/route"));
  ({ setProviderForTesting } = await import("../src/lib/llm"));
  ({ rateLimit } = await import("../src/lib/security/rate-limit"));
  let providerCalls = 0;

  const g0 = await globalLeft(); // 5 -> 4 left
  const noProvider = await call(valid);
  check("no provider configured -> 503 unavailable", noProvider.status === 503 && (await noProvider.json()).code === "unavailable");
  const badJson = await call("{not json");
  check("invalid JSON -> 400", badJson.status === 400);
  const badTask = await call({ task: "explain" });
  check("invalid task -> 400", badTask.status === 400);
  check("…with RateLimit headers on the 400", badTask.headers.get("ratelimit-limit") === "30");
  const unknown = await call({ task: "write-my-novel" });
  check("unknown task -> 400", unknown.status === 400);
  const g1 = await globalLeft();
  check("none of those consumed the global ceiling", g1 === g0 - 1, { g0, g1 });

  setProviderForTesting({
    async complete() {
      providerCalls++;
      return "Numbers make impact concrete: add counts, percentages or money where you can.";
    },
  });
  const ok = await call(valid);
  const okBody = await ok.json();
  check("valid request -> 200", ok.status === 200 && okBody.ok === true, okBody);
  check("success carries RateLimit headers", ok.headers.get("ratelimit-remaining") === "29");
  const g2 = await globalLeft();
  check("valid request consumed exactly one unit", g2 === g1 - 2, { g1, g2 });

  // g2 == 1 left; one more valid call uses it, then the ceiling is hit.
  await call(valid);
  const before = providerCalls;
  const capped = await call(valid);
  const cappedBody = await capped.json();
  check("ceiling reached -> 429 daily_limit", capped.status === 429 && cappedBody.code === "daily_limit", cappedBody);
  check("…with Retry-After", Number(capped.headers.get("retry-after")) > 3600);
  check("…and the provider was not called", providerCalls === before);
  console.log(`   message: "${cappedBody.error}"`);

  const fromNewIp = await call({ task: "explain" }, "203.0.113.200");
  check("invalid requests still get 400 (not 429) after the ceiling", fromNewIp.status === 400);

  const crossSite = await POST(new Request("http://localhost:3000/api/llm", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
    body: JSON.stringify(valid),
  }));
  check("cross-site -> 403", crossSite.status === 403);

  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
