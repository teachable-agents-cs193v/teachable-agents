import "server-only";

let warned = false;

/**
 * Whether auth can run. In development a teammate may run `npm run dev` with no
 * DATABASE_URL; then auth reports "logged out" (with one warning) instead of
 * throwing on every page. In production a missing database is a real error and
 * is left to fail loudly.
 */
export function authAvailable(): boolean {
  if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") return true;
  if (!warned) {
    warned = true;
    console.warn("[auth] DATABASE_URL is not set: everyone appears logged out and login/signup are disabled. See .env.example.");
  }
  return false;
}

/** What /api/auth/* returns while auth is unavailable (development only). */
export function authUnavailableResponse(request: Request): Response {
  // The Navbar's session check: just "nobody is logged in".
  if (new URL(request.url).pathname.endsWith("/get-session")) return Response.json(null);
  return Response.json(
    { code: "auth_unavailable", message: "Sign-in isn't set up on this server (DATABASE_URL is not set)." },
    { status: 503 },
  );
}
