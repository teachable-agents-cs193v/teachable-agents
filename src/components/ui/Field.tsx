import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

/** Label + hint wrapper so every form control gets consistent, accessible markup. */
export function Field({ id, label, hint, optional, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="font-medium text-charcoal">
        {label}
        {optional && <span className="ml-2 text-sm font-normal text-muted">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export const inputClasses =
  "focus-ring w-full rounded-xl border border-line bg-paper px-4 py-3 text-charcoal placeholder:text-muted/70 transition-colors hover:border-forest/40 focus:border-forest";
