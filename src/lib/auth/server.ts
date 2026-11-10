import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthUser } from "@/lib/types";
import { getAuth } from "./auth";
import { safeNextPath } from "./nextPath";

/**
 * How pages and API routes get the logged-in user (docs/AUTH.md). Always use
 * these rather than calling Better Auth directly.
 */

/**
 * The logged-in user, or null. `cache()` dedupes calls within one server
 * component render; in a route handler each call is its own lookup.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  // Read the request first: this marks the page as per-request, so Next never tries
  // to pre-render it at build time (when there is no request, secret or database).
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

/** For pages: the logged-in user, or a redirect to /login?next=<path>. */
export async function requireUser(next?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const path = safeNextPath(next);
  redirect(path ? `/login?next=${encodeURIComponent(path)}` : "/login");
}

/** For API routes: the logged-in user, or a 401 JSON response to return as-is. */
export async function requireApiUser(): Promise<AuthUser | Response> {
  const user = await getCurrentUser();
  if (user) return user;
  return Response.json({ error: "Not logged in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
