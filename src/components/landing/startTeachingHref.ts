import { withNext } from "@/lib/auth/nextPath";

/**
 * Where "Start teaching" on the public landing page goes. Teaching needs an
 * account, so a visitor is sent to sign up (with a link to log in) and lands
 * in the lesson library afterwards. Logged-in students never see the landing
 * page (it redirects them to the dashboard), and every teaching route still
 * checks the session on the server (requireUser).
 */
export const START_TEACHING_HREF = withNext("/signup", "/topics");
