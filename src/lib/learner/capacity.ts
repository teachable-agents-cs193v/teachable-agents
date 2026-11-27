/**
 * What a student sees when Pip's models fail: out of capacity (a rate limit or the daily quota),
 * or any other server error, and when the student hits their own turn limit. Shared by the /turn route and the browser client, which tell the
 * capacity case apart by the response's `code`, never by its text. Safe to import from the
 * browser and the server.
 */

/** Any other server-side failure of a turn (#22: never the raw error). */
export const PIP_BUSY = "Pip is having trouble thinking right now. Wait a moment and try again.";

/** The `code` a 503 carries when the provider is rate limited or out of quota. */
export const AT_CAPACITY = "at_capacity";

/** "in about 3 minutes" for a known wait; "in a few minutes" when we don't know it. */
function when(retryAfterSeconds?: number): string {
  if (!retryAfterSeconds || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) return "in a few minutes";
  if (retryAfterSeconds <= 90) return "in about a minute";
  const minutes = Math.ceil(retryAfterSeconds / 60);
  if (minutes < 60) return `in about ${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`;
}

/**
 * When this student has sent Pip too many messages (the per-user turn limit, #55). A 429 with
 * this text and `code: "rate_limited"`; the browser shows 4xx text as is.
 */
export function tooManyTurnsMessage(retryAfterSeconds?: number): string {
  return `You've sent Pip a lot of messages in a short time. Take a short break and try again ${when(retryAfterSeconds)}.`;
}

/** The student-safe message. Never includes anything the provider said. */
export function atCapacityMessage(retryAfterSeconds?: number): string {
  return `Pip is at capacity right now: a lot of people are teaching at once. Try again ${when(retryAfterSeconds)}.`;
}
