import "server-only";
import { TIPS, checkStrength, userInputsFor, type StrengthResult } from "./passwordStrength";
import { BreachCheckUnavailable, isPwned } from "./pwned";

/**
 * The signup password policy (docs/AUTH.md): zxcvbn strength, then the Pwned
 * Passwords breach check, which fails closed. The signup hook (#11) calls this
 * before anything is hashed or stored, and turns a failure into an HTTP
 * response with the given status and body. Length limits are Better Auth's
 * own `minPasswordLength` / `maxPasswordLength` settings, not part of this.
 */

type Fail<S extends number, C extends string, X = object> = { ok: false; status: S; code: C; error: string } & X;

export type PolicyResult =
  | { ok: true }
  | Fail<422, "weak_password", Omit<StrengthResult, "ok">>
  | Fail<422, "breached_password", { suggestions: string[] }>
  | Fail<503, "breach_check_unavailable">;

export async function checkSignupPassword(
  password: string,
  user: { name?: string; email?: string },
): Promise<PolicyResult> {
  // The strength check is local, so run it first and skip the breach lookup for weak ones.
  const { ok, ...feedback } = checkStrength(password, userInputsFor(user));
  if (!ok) {
    return { ok: false, status: 422, code: "weak_password", error: "Please choose a password that’s harder to guess.", ...feedback };
  }

  try {
    if (await isPwned(password)) {
      return {
        ok: false,
        status: 422,
        code: "breached_password",
        error: "This password has appeared in a known data breach, so it can’t be used. Please choose a different password.",
        suggestions: ["Avoid reusing a password from another account.", TIPS.passphrase],
      };
    }
  } catch (e) {
    if (!(e instanceof BreachCheckUnavailable)) throw e;
    console.error("Pwned Passwords check unavailable:", e.message);
    return {
      ok: false,
      status: 503,
      code: "breach_check_unavailable",
      error:
        "We couldn’t check this password against known data breaches right now, so your account wasn’t created. Please try again in a few minutes.",
    };
  }
  return { ok: true };
}
