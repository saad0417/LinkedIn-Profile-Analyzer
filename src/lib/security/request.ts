/**
 * Cheap request guards shared by the API routes: cross-site check and
 * size-capped body reading.
 */

/**
 * Refuse POSTs that a browser sends on behalf of ANOTHER site.
 *
 * These APIs use no cookies or auth, so classic CSRF can't act "as" a user.
 * The real risk is a third-party page making its visitors' browsers call us:
 * multipart uploads are CORS "simple" requests (no preflight), so the work
 * would run, spread across many IPs and therefore past the per-IP limits.
 *
 * Rules:
 * - Sec-Fetch-Site (sent by every current browser): allow "same-origin" and
 *   "none" (typed URL / bookmark); refuse "cross-site" and "same-site".
 * - Otherwise an Origin header must match this host (or NEXT_PUBLIC_SITE_URL);
 *   "null" (sandboxed frames, file://) is refused.
 * - No Sec-Fetch-Site and no Origin: a non-browser client (curl, scripts).
 *   Allowed: they can't be used for cross-site abuse, and they're still rate
 *   limited per IP like everyone else.
 */
export function isCrossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";

  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (origin === "null") return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true;
  }
  const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")]
    .flatMap((h) => (h ? h.split(",").map((x) => x.trim().toLowerCase()) : []));
  const site_url = process.env.NEXT_PUBLIC_SITE_URL;
  if (site_url) {
    try {
      hosts.push(new URL(site_url).host.toLowerCase());
    } catch {
      /* ignore a malformed site URL */
    }
  }
  return !hosts.includes(originHost);
}

export type BodyRead = { ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" | "unreadable" };

/** True when the client declares a body larger than `max` (cheap pre-check; never trusted alone). */
export function declaresTooLarge(req: Request, max: number): boolean {
  const raw = req.headers.get("content-length");
  if (raw === null) return false;
  const n = Number(raw);
  return !Number.isFinite(n) || n < 0 || n > max;
}

/**
 * Read the body, stopping as soon as it exceeds `max` bytes. Content-Length
 * can be missing (chunked) or wrong, so the cap is enforced on the bytes
 * actually received.
 */
export async function readBodyCapped(req: Request, max: number): Promise<BodyRead> {
  if (declaresTooLarge(req, max)) return { ok: false, reason: "too_large" };
  if (!req.body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  return { ok: true, bytes };
}

/** Parse a capped multipart body read with readBodyCapped. Throws on malformed input. */
export function parseMultipart(req: Request, bytes: Uint8Array): Promise<FormData> {
  return new Response(bytes as BodyInit, {
    headers: { "content-type": req.headers.get("content-type") ?? "" },
  }).formData();
}

/** Decode a capped body as UTF-8 JSON. Returns undefined when it isn't valid JSON. */
export function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  } catch {
    return undefined;
  }
}

export function isJsonContentType(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

export function isMultipart(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data");
}
