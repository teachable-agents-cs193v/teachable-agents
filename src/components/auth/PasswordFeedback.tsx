"use client";

import { useEffect, useState } from "react";
import type { StrengthResult } from "@/lib/auth/passwordStrength";
import { cn } from "@/lib/utils";

/**
 * Live password-strength feedback for the signup form. Display only: the server
 * enforces the same check (plus the breach check). zxcvbn (~800 KB) is loaded on
 * the first keystroke, not with the page.
 */
export function PasswordFeedback({ id, password, name, email }: { id: string; password: string; name: string; email: string }) {
  const [result, setResult] = useState<StrengthResult | null>(null);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { checkStrength, userInputsFor } = await import("@/lib/auth/passwordStrength");
      if (!cancelled) setResult(checkStrength(password, userInputsFor({ name, email })));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [password, name, email]);

  const shown = password ? result : null;
  return (
    <div id={id} aria-live="polite" className="min-h-6 text-sm">
      {shown && (
        <>
          <p>
            Strength:{" "}
            <span className={cn("font-semibold", shown.ok ? "text-forest" : "text-danger")} data-testid="password-strength">
              {shown.label}
            </span>
            {shown.ok ? " — good to go." : " — try something harder to guess."}
          </p>
          {shown.warning && <p className="mt-1 text-muted">{shown.warning}</p>}
          {shown.suggestions.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-muted">
              {shown.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
