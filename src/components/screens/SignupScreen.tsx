"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { FormErrorAlert } from "@/components/auth/FormErrorAlert";
import { PasswordFeedback } from "@/components/auth/PasswordFeedback";
import { useAuthSubmit } from "@/components/auth/useAuthSubmit";
import { Button } from "@/components/ui/Button";
import { Field, inputClasses } from "@/components/ui/Field";
import { authClient } from "@/lib/auth/client";
import { withNext } from "@/lib/auth/nextPath";

const ERROR_ID = "signup-error";
const FEEDBACK_ID = "signup-password-feedback";

/** `next` has already been checked with safeNextPath on the server. */
export function SignupScreen({ next }: { next?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, pending, onSubmit } = useAuthSubmit(
    "signup",
    () => authClient.signUp.email({ name: name.trim(), email, password }),
    next,
  );

  const loginHref = withNext("/login", next);
  const passwordError = error && !error.offerLogin;
  return (
    <AuthCard title="Create your account" subtitle="Save your teaching sessions and come back to them anytime.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <FormErrorAlert id={ERROR_ID} error={error} loginHref={loginHref} />}
        <Field id="signup-name" label="Name">
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field id="signup-email" label="Email">
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error?.offerLogin}
            aria-describedby={error?.offerLogin ? ERROR_ID : undefined}
            className={inputClasses}
          />
        </Field>
        <Field id="signup-password" label="Password" hint="At least 8 characters. A few unrelated words make a strong password.">
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!passwordError}
            aria-describedby={["signup-password-hint", FEEDBACK_ID, passwordError ? ERROR_ID : ""].filter(Boolean).join(" ")}
            className={inputClasses}
          />
          <PasswordFeedback id={FEEDBACK_ID} password={password} name={name} email={email} />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Sign up"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={loginHref} className="focus-ring rounded font-medium text-forest underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
