import { MAX_BODY_BYTES } from "@/lib/persistence/validate";
import { hitRateLimit, type RateLimitAction } from "@/lib/rateLimit";

/** Shared by the /api/sessions routes. Student data is never cached. */
export const NO_STORE = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
export const error = (message: string, status: number) => json({ error: message }, status);
export const notFound = () => error("Not found.", 404);

/** The `code` a 429 from these routes carries, so the browser can tell it apart without reading the text. */
export const RATE_LIMITED = "rate_limited";

/**
 * Counts this request against the user's limit for `action` (src/lib/rateLimit.ts, #58).
 * Returns null when it's allowed, or the 429 to send: a friendly message, `code`,
 * `retryAfterSeconds` and a matching Retry-After header.
 */
export async function rateLimit(userId: string, action: RateLimitAction): Promise<Response | null> {
  const result = await hitRateLimit(userId, action);
  if (result.ok) return null;
  const { retryAfterSeconds } = result;
  return Response.json(
    { error: "You're doing that too often. Wait a few minutes and try again.", code: RATE_LIMITED, retryAfterSeconds },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfterSeconds) } },
  );
}

/**
 * Reads a JSON request body, or returns the error response to send.
 * Requiring `application/json` also blocks plain cross-site form posts, which
 * can't set that content type without a CORS preflight.
 */
export async function readJson(request: Request): Promise<{ body: unknown } | Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return error("Expected application/json.", 415);
  }
  // Refuse early when the declared size is too big, then check the real size in bytes.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return error("Request too large.", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return error("Request too large.", 413);
  try {
    return { body: JSON.parse(text) };
  } catch {
    return error("Invalid JSON.", 400);
  }
}
