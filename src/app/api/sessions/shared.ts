import { MAX_BODY_BYTES } from "@/lib/persistence/validate";

/** Shared by the /api/sessions routes. Student data is never cached. */
export const NO_STORE = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
export const error = (message: string, status: number) => json({ error: message }, status);
export const notFound = () => error("Not found.", 404);

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
