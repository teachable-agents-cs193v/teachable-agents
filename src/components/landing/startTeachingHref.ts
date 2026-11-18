import { withNext } from "@/lib/auth/nextPath";

/**
 * Where "Start teaching" on the public landing page goes. Teaching needs an
 * account, so a visitor is sent to sign up (with a link to log in) and comes
 * back to the lesson library afterwards. A logged-in student goes straight
 * there. The library itself stays public as a preview; every teaching route
 * still checks the session on the server (requireUser).
 */
export function startTeachingHref(loggedIn: boolean): string {
  return loggedIn ? "/topics" : withNext("/signup", "/topics");
}
