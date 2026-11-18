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
        {optional && <span className="ml-2 font-mono text-xs font-normal uppercase tracking-[0.08em] text-muted">optional</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

/** Inputs and textareas: paper surface, 12px corners, leaf-green focus border. */
export const inputClasses =
  "focus-ring w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-charcoal placeholder:text-muted/60 " +
  "transition-colors hover:border-sage-deep focus:border-leaf disabled:cursor-not-allowed disabled:bg-ivory-deep disabled:text-muted";
