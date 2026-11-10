/**
 * Turns an error from the auth client into what the login/signup forms show.
 * The server decides; this only words it. Shapes come from Better Auth's
 * error body plus our password-policy codes (docs/AUTH.md).
 */

export interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
  warning?: string;
  suggestions?: unknown;
}

export interface FormError {
  message: string;
  tips: string[];
  /** Signup only: the email is taken, so offer a link to log in instead. */
  offerLogin?: boolean;
}

const tipsFrom = (value: unknown) =>
  Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];

export const NETWORK_ERROR: FormError = {
  message: "We couldn't reach the server. Check your connection and try again.",
  tips: [],
};

const MISMATCH = "That email and password don't match an account.";

export function describeAuthError(error: AuthErrorLike, form: "login" | "signup"): FormError {
  switch (error.code) {
    // Our password-policy codes: the server already sends the wording (passwordPolicy.ts).
    case "weak_password":
    case "breached_password":
    case "breach_check_unavailable": {
      const message = [error.message, error.warning].filter(Boolean).join(" ");
      return { message: message || "Please choose a different password.", tips: tipsFrom(error.suggestions) };
    }
    // Better Auth's codes are terse, so word them here.
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { message: "An account with this email already exists.", tips: [], offerLogin: true };
    case "INVALID_EMAIL_OR_PASSWORD":
      return { message: MISMATCH, tips: [] };
    case "INVALID_EMAIL":
      return { message: "Please enter a valid email address.", tips: [] };
    case "PASSWORD_TOO_SHORT":
      return { message: "Your password needs at least 8 characters.", tips: [] };
    case "PASSWORD_TOO_LONG":
      return { message: "Your password can be at most 128 characters.", tips: [] };
    case "auth_unavailable":
      return { message: "Sign-in isn't set up on this server yet.", tips: [] };
  }
  if (error.status === 429) return { message: "Too many attempts. Please wait a minute and try again.", tips: [] };
  if (form === "login" && error.status === 401) return { message: MISMATCH, tips: [] };
  return {
    message: form === "login" ? "We couldn't log you in. Please try again." : "We couldn't create your account. Please try again.",
    tips: [],
  };
}
