/**
 * What a student sees when the AI provider is out of capacity (a rate limit or the daily quota).
 * Shared by the /turn route and the browser client, which tell it apart from other failures by
 * the response's `code`, never by its text. Safe to import from the browser and the server.
 */

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

/** The student-safe message. Never includes anything the provider said. */
export function atCapacityMessage(retryAfterSeconds?: number): string {
  return `Pip is at capacity right now: a lot of people are teaching at once. Try again ${when(retryAfterSeconds)}.`;
}
