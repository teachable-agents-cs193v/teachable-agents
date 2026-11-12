import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { getPool } from "@/lib/db/pool";
import { authSchemaOptions } from "./options";

/** The value in .env.example; a copy of it in production would make the signing key public. */
const PLACEHOLDER_SECRET = "replace-with-output-of-openssl-rand-base64-32";
const MIN_SECRET_LENGTH = 32;

/** Throws unless the secret is set, long enough, and not the .env.example placeholder. */
export function assertUsableSecret(secret: string | undefined): asserts secret is string {
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  if (secret === PLACEHOLDER_SECRET) throw new Error("BETTER_AUTH_SECRET is still the .env.example placeholder.");
  if (secret.length < MIN_SECRET_LENGTH)
    throw new Error(`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
}

/**
 * Every Better Auth HTTP endpoint that sets a password: the body field holding
 * it, and whether the caller must already be logged in. (Server code calling
 * auth.api.setPassword directly is not covered; don't.)
 */
const PASSWORD_ENDPOINTS: Record<string, { field: string; needsSession: boolean }> = {
  "/sign-up/email": { field: "password", needsSession: false },
  "/change-password": { field: "newPassword", needsSession: true },
  // Unreachable until password reset is enabled (no reset emails are sent), but covered now.
  "/reset-password": { field: "newPassword", needsSession: false },
};

/** Runs the password policy (strength + breach check) before Better Auth stores any password. */
const passwordPolicyHook = createAuthMiddleware(async (ctx) => {
  const endpoint = PASSWORD_ENDPOINTS[ctx.path];
  if (!endpoint) return;
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  const password = body[endpoint.field];
  // Better Auth validates the body itself; this only skips what it will reject anyway.
  if (typeof password !== "string") return;

  // Hooks run before Better Auth's own session check. For endpoints that need a
  // login, check it first: logged-out callers get Better Auth's 401, not a free
  // run of the policy (and of the outbound breach lookup).
  let user: { name?: unknown; email?: unknown } = body;
  if (endpoint.needsSession) {
    const session = await getSessionFromCtx(ctx);
    if (!session) return;
    user = session.user;
  }

  // Loaded only here, so zxcvbn's dictionaries stay off other auth requests' cold starts.
  const { checkSignupPassword } = await import("./passwordPolicy");
  const result = await checkSignupPassword(password, {
    name: typeof user.name === "string" ? user.name : undefined,
    email: typeof user.email === "string" ? user.email : undefined,
  });
  if (result.ok) return;
  // Response body: the code, a message and any feedback (warning, suggestions).
  const { status, error, ...details } = result;
  const responseBody: Record<string, unknown> = { ...details, message: error };
  delete responseBody.ok;
  throw new APIError(status, responseBody);
});

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  // Development and tests may use any secret; production must have a real one.
  if (process.env.NODE_ENV === "production") assertUsableSecret(secret);
  // Better Auth reads BETTER_AUTH_URL from the environment itself.
  return betterAuth({ ...authSchemaOptions(getPool()), secret, hooks: { before: passwordPolicyHook } });
}

let auth: ReturnType<typeof createAuth> | undefined;
/** The Better Auth instance, created on first use so `next build` needs no secrets or database. */
export const getAuth = () => (auth ??= createAuth());
