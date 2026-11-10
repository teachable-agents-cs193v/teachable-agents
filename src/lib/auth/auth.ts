import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { getPool } from "@/lib/db/pool";
import { authSchemaOptions } from "./options";
import { checkSignupPassword } from "./passwordPolicy";

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

/** HTTP status names Better Auth's APIError expects, keyed by our policy's status codes. */
const STATUS_NAMES = { 422: "UNPROCESSABLE_ENTITY", 503: "SERVICE_UNAVAILABLE" } as const;

/** Runs the signup password policy before Better Auth creates anything. */
const signupPasswordPolicy = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-up/email") return;
  const { password, name, email } = (ctx.body ?? {}) as { password?: unknown; name?: unknown; email?: unknown };
  // Better Auth validates the body itself; this only skips what it will reject anyway.
  if (typeof password !== "string") return;
  const result = await checkSignupPassword(password, {
    name: typeof name === "string" ? name : undefined,
    email: typeof email === "string" ? email : undefined,
  });
  if (result.ok) return;
  // Body: code, message and any feedback. JSON drops the undefined fields.
  const body = { ...result, message: result.error, ok: undefined, status: undefined, error: undefined };
  throw new APIError(STATUS_NAMES[result.status], body);
});

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  // Development and tests may use any secret; production must have a real one.
  if (process.env.NODE_ENV === "production") assertUsableSecret(secret);
  return betterAuth({
    ...authSchemaOptions(getPool()),
    secret,
    baseURL: process.env.BETTER_AUTH_URL,
    hooks: { before: signupPasswordPolicy },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/**
 * The Better Auth instance, created on first use rather than at import so
 * `next build` never needs secrets or a database.
 */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}
