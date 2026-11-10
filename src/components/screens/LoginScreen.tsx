"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { FormErrorAlert } from "@/components/auth/FormErrorAlert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClasses } from "@/components/ui/Field";
import { authClient } from "@/lib/auth/client";
import { NETWORK_ERROR, describeAuthError, type FormError } from "@/lib/auth/errorMessages";

const ERROR_ID = "login-error";

/** `next` has already been checked with safeNextPath on the server. */
export function LoginScreen({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(describeAuthError(error, "login"));
      } else {
        router.replace(next ?? "/topics");
        router.refresh();
        return; // stay "pending" while navigating away
      }
    } catch {
      setError(NETWORK_ERROR);
    }
    inFlight.current = false;
    setPending(false);
  };

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  return (
    <AuthCard title="Welcome back" subtitle="Log in to keep teaching Pip and see your past sessions.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <FormErrorAlert id={ERROR_ID} error={error} />}
        <Field id="login-email" label="Email">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? ERROR_ID : undefined}
            className={inputClasses}
          />
        </Field>
        <Field id="login-password" label="Password">
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? ERROR_ID : undefined}
            className={inputClasses}
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href={signupHref} className="focus-ring rounded font-medium text-forest underline">
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl text-forest">{title}</h1>
      <p className="mt-2 text-muted">{subtitle}</p>
      <Card className="mt-8 p-6 sm:p-8">{children}</Card>
    </section>
  );
}
