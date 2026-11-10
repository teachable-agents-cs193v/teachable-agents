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

export function describeAuthError(error: AuthErrorLike, form: "login" | "signup"): FormError {
  switch (error.code) {
    case "weak_password": {
      const message = error.warning ? `This password is too easy to guess. ${error.warning}` : "This password is too easy to guess.";
      return { message, tips: tipsFrom(error.suggestions) };
    }
    case "breached_password":
      return {
        message: "This password has appeared in a known data breach, so it can't be used. Please choose a different one.",
        tips: tipsFrom(error.suggestions),
      };
    case "breach_check_unavailable":
      return {
        message: "We couldn't check this password against known data breaches just now, so your account wasn't created. Please try again in a few minutes.",
        tips: [],
      };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { message: "An account with this email already exists.", tips: [], offerLogin: true };
    case "INVALID_EMAIL_OR_PASSWORD":
      return { message: "That email and password don't match an account.", tips: [] };
    case "INVALID_EMAIL":
      return { message: "Please enter a valid email address.", tips: [] };
    case "PASSWORD_TOO_SHORT":
      return { message: "Your password needs at least 8 characters.", tips: [] };
    case "PASSWORD_TOO_LONG":
      return { message: "Your password can be at most 128 characters.", tips: [] };
  }
  if (error.status === 429) return { message: "Too many attempts. Please wait a minute and try again.", tips: [] };
  if (form === "login" && error.status === 401) {
    return { message: "That email and password don't match an account.", tips: [] };
  }
  return {
    message: form === "login" ? "We couldn't log you in. Please try again." : "We couldn't create your account. Please try again.",
    tips: [],
  };
}

/** The first word of the student's name, for the Navbar greeting. */
export function firstName(name: string | null | undefined, email?: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || email?.split("@")[0] || "there";
}
