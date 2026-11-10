/**
 * Where to send someone after they log in, from a `?next=` value. Only
 * same-site relative paths are allowed, so a login link can't be used to send
 * people to another site. Shared by the server helpers and the login form (#13).
 */
export function safeNextPath(next: string | null | undefined): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return undefined;
  return next;
}
