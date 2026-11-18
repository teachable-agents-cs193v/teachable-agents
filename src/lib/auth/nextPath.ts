/**
 * Where to send someone after they log in, from a `?next=` value. Only
 * same-site paths are allowed, so a login link can't be used to send people to
 * another site. Shared by the server helpers and the login form (#13).
 */
const BASE = "http://same-site.invalid";

export function safeNextPath(next: string | null | undefined): string | undefined {
  if (!next || !next.startsWith("/")) return undefined;
  // Browsers strip tabs and newlines from URLs ("/\t/evil.com" becomes "//evil.com")
  // and treat "\" like "/", so refuse those characters anywhere.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return undefined;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return undefined;
  }
  // "//evil.com" and similar resolve to another origin.
  if (url.origin !== BASE) return undefined;
  const path = url.pathname + url.search + url.hash;
  // Dot segments can normalize to "//evil.com" ("/..//evil.com"), which is another site again.
  if (path.startsWith("//")) return undefined;
  return path;
}

/** `path` with `?next=<next>` added when there is a (safe) next path. */
export function withNext(path: string, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
