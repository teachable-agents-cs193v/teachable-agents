import Link from "next/link";
import type { FormError } from "@/lib/auth/errorMessages";

/** The form-level error for login/signup, announced to screen readers. */
export function FormErrorAlert({ id, error, loginHref }: { id: string; error: FormError; loginHref?: string }) {
  return (
    <div id={id} role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      <p className="font-medium">
        {error.message}
        {error.offerLogin && loginHref && (
          <>
            {" "}
            <Link href={loginHref} className="focus-ring rounded underline">
              Log in instead?
            </Link>
          </>
        )}
      </p>
      {error.tips.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-charcoal">
          {error.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
