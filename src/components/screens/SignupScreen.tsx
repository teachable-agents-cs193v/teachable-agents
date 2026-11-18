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
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/options";

const ERROR_ID = "signup-error";
const FEEDBACK_ID = "signup-password-feedback";

/** `next` has already been checked with safeNextPath on the server. */
export function SignupScreen({ next }: { next?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, pending, onSubmit } = useAuthSubmit(
    "signup",
    // `required` accepts spaces only, so check the trimmed name here too.
    async () => (name.trim() ? authClient.signUp.email({ name: name.trim(), email, password }) : { error: { code: "missing_name" } }),
    next,
  );

  const loginHref = withNext("/login", next);
  // Mark only the input the error is about; general errors stay form-level.
  const invalid = (field: "name" | "email" | "password") => error?.field === field;
  const describedBy = (field: "name" | "email" | "password", ...ids: string[]) =>
    [...ids, invalid(field) ? ERROR_ID : ""].filter(Boolean).join(" ") || undefined;
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
            aria-invalid={invalid("name")}
            aria-describedby={describedBy("name")}
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
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
            className={inputClasses}
          />
        </Field>
        <Field
          id="signup-password"
          label="Password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A few unrelated words make a strong password.`}
        >
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalid("password")}
            aria-describedby={describedBy("password", "signup-password-hint", FEEDBACK_ID)}
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
