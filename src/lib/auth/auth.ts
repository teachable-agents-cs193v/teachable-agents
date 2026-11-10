import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
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

/** Every Better Auth endpoint that sets a password, and the body field holding it. */
const PASSWORD_FIELDS: Record<string, string> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
};

/** Runs the password policy (strength + breach check) before Better Auth stores any password. */
const passwordPolicyHook = createAuthMiddleware(async (ctx) => {
  const field = PASSWORD_FIELDS[ctx.path];
  if (!field) return;
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  const password = body[field];
  // Better Auth validates the body itself; this only skips what it will reject anyway.
  if (typeof password !== "string") return;
  // Loaded only here, so zxcvbn's dictionaries stay off other auth requests' cold starts.
  const { checkSignupPassword } = await import("./passwordPolicy");
  const result = await checkSignupPassword(password, {
    name: typeof body.name === "string" ? body.name : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
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
