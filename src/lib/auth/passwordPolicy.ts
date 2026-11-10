import "server-only";
import { checkStrength, userInputsFor } from "./passwordStrength";
import { BreachCheckUnavailable, isPwned } from "./pwned";

/**
 * The signup password policy (docs/AUTH.md): length, then zxcvbn strength,
 * then the Pwned Passwords breach check, which fails closed. The signup hook
 * (#11) calls this before anything is hashed or stored and turns a failure
 * into an HTTP response with the given status and body.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128; // Better Auth's default maximum

export type PolicyFailure =
  | { ok: false; status: 400; code: "invalid_password_length"; error: string }
  | {
      ok: false;
      status: 422;
      code: "weak_password";
      error: string;
      score: number;
      label: string;
      warning: string;
      suggestions: string[];
    }
  | { ok: false; status: 422; code: "breached_password"; error: string; suggestions: string[] }
  | { ok: false; status: 503; code: "breach_check_unavailable"; error: string };

export type PolicyResult = { ok: true } | PolicyFailure;

type Options = { isPwnedImpl?: (password: string) => Promise<boolean> };

export async function checkSignupPassword(
  password: string,
  user: { name?: string; email?: string },
  { isPwnedImpl = isPwned }: Options = {},
): Promise<PolicyResult> {
  const length = [...password].length;
  if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      code: "invalid_password_length",
      error: `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`,
    };
  }

  // The strength check is local, so run it first and skip the breach lookup for weak ones.
  const strength = checkStrength(password, userInputsFor(user));
  if (!strength.ok) {
    const { score, label, warning, suggestions } = strength;
    return {
      ok: false,
      status: 422,
      code: "weak_password",
      error: "Please choose a password that’s harder to guess.",
      score,
      label,
      warning,
      suggestions,
    };
  }

  try {
    if (await isPwnedImpl(password)) {
      return {
        ok: false,
        status: 422,
        code: "breached_password",
        error: "This password has appeared in a known data breach, so it can’t be used. Please choose a different password.",
        suggestions: [
          "Avoid reusing a password from another account.",
          "Consider using a longer passphrase made of several unrelated words.",
        ],
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
