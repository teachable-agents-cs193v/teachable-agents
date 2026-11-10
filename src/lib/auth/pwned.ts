import "server-only";
import crypto from "node:crypto";

/**
 * Server-only check against the Pwned Passwords database, ported from Anahi's
 * A10 project. It uses a k-anonymity range query: only the first five hex
 * characters of the password's SHA-1 hash leave this server, and the returned
 * suffixes are compared here. Never log the password, its hash, or the prefix.
 */

const DEFAULT_API_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // the database changes rarely
const CACHE_MAX = 1_000;
const LINE_RE = /^([0-9A-F]{35}):(\d+)$/;

/** Thrown when the check can't complete. Signup must fail closed on it. */
export class BreachCheckUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BreachCheckUnavailable";
  }
}

type Counts = Map<string, number>;
type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

/**
 * prefix -> breach counts by suffix. Only public breach data keyed by a
 * 5-character prefix is cached, never anything password-specific.
 */
const cache = new Map<string, { expires: number; counts: Counts }>();
/** prefix -> in-flight request, so simultaneous signups share one request. */
const pending = new Map<string, Promise<Counts>>();

export function clearPwnedCache(): void {
  cache.clear();
  pending.clear();
}

async function fetchRange(prefix: string, fetchImpl: FetchImpl, timeoutMs: number): Promise<Counts> {
  // The override exists so tests can point at a local mock; it is not a secret.
  const url = (process.env.PWNED_PASSWORDS_API_URL || DEFAULT_API_URL) + prefix;
  let body: string;
  try {
    const res = await fetchImpl(url, {
      // Padding hides how many suffixes share our prefix from network observers.
      headers: { "Add-Padding": "true", "User-Agent": "teachable-agents-signup" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status !== 200) throw new BreachCheckUnavailable(`unexpected status ${res.status}`);
    body = await res.text();
  } catch (e) {
    if (e instanceof BreachCheckUnavailable) throw e;
    throw new BreachCheckUnavailable((e as Error)?.name === "TimeoutError" ? "timed out" : "network error");
  }
  const counts: Counts = new Map();
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = LINE_RE.exec(trimmed);
    if (!m) throw new BreachCheckUnavailable("malformed response");
    counts.set(m[1], Number(m[2]));
  }
  // A real (padded) response always has hundreds of entries.
  if (counts.size === 0) throw new BreachCheckUnavailable("empty response");
  return counts;
}

function rangeFor(prefix: string, fetchImpl: FetchImpl, timeoutMs: number): Promise<Counts> {
  const hit = cache.get(prefix);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.counts);
  const inFlight = pending.get(prefix);
  if (inFlight) return inFlight;
  const p = fetchRange(prefix, fetchImpl, timeoutMs)
    .then((counts) => {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(prefix, { expires: Date.now() + CACHE_TTL_MS, counts });
      return counts;
    })
    .finally(() => pending.delete(prefix));
  pending.set(prefix, p);
  return p;
}

/**
 * Resolves to true if the password appears in a known breach, false if not.
 * Rejects with BreachCheckUnavailable if the check couldn't be completed.
 */
export async function isPwned(
  password: string,
  { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS }: { fetchImpl?: FetchImpl; timeoutMs?: number } = {},
): Promise<boolean> {
  const hash = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const counts = await rangeFor(hash.slice(0, 5), fetchImpl, timeoutMs);
  // Padding entries have a count of 0 and don't mean a breach.
  return (counts.get(hash.slice(5)) ?? 0) > 0;
}
