import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthUser } from "@/lib/types";
import { getAuth } from "./auth";

/**
 * How pages and API routes get the logged-in user (docs/AUTH.md). Always use
 * these rather than calling Better Auth directly.
 */

/** The logged-in user, or null. Looks up the session at most once per request. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

/**
 * Only same-site relative paths are allowed as a post-login destination, so the
 * login link can't be used to send someone to another site.
 */
export function safeNextPath(next: string | undefined): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return undefined;
  return next;
}

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
