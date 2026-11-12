"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { FormErrorAlert } from "@/components/auth/FormErrorAlert";
import { useAuthSubmit } from "@/components/auth/useAuthSubmit";
import { Button } from "@/components/ui/Button";
import { Field, inputClasses } from "@/components/ui/Field";
import { authClient } from "@/lib/auth/client";
import { withNext } from "@/lib/auth/nextPath";

const ERROR_ID = "login-error";

/** `next` has already been checked with safeNextPath on the server. */
export function LoginScreen({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, pending, onSubmit } = useAuthSubmit("login", () => authClient.signIn.email({ email, password }), next);

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
        <Link href={withNext("/signup", next)} className="focus-ring rounded font-medium text-forest underline">
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
