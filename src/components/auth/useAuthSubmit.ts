"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { NETWORK_ERROR, describeAuthError, type AuthErrorLike, type FormError } from "@/lib/auth/errorMessages";

/**
 * Submit handling shared by the login and signup forms: blocks double submits,
 * turns errors into form messages, and on success goes to `next` (already
 * checked with safeNextPath) or /topics.
 */
export function useAuthSubmit(
  form: "login" | "signup",
  call: () => Promise<{ error: AuthErrorLike | null }>,
  next: string | undefined,
) {
  const router = useRouter();
  const [error, setError] = useState<FormError | null>(null);
  const [pending, setPending] = useState(false);
  // State updates are async, so a ref also blocks a fast double-click.
  const inFlight = useRef(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const { error } = await call();
      if (!error) {
        router.replace(next ?? "/topics");
        router.refresh();
        return; // stay "pending" while navigating away
      }
      setError(describeAuthError(error, form));
    } catch {
      setError(NETWORK_ERROR);
    }
    inFlight.current = false;
    setPending(false);
  };

  return { error, pending, onSubmit };
}
