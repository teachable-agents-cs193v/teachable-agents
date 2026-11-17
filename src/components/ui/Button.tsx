import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons from the style tile: deep green primary, outlined secondary, butter
 * for "in progress" moments. 12px corners, no gradients, a very light shadow.
 *
 * States: hover darkens, focus shows the shared ring, `disabled` fades, and
 * `loading` keeps the label but disables the control and marks it busy.
 */
type Variant = "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "bg-forest text-ivory shadow-soft hover:bg-forest-deep hover:shadow-lift",
  secondary: "bg-sage text-forest hover:bg-sage-deep",
  outline: "border-[1.5px] border-charcoal/70 bg-paper text-charcoal hover:border-charcoal hover:bg-mint",
  ghost: "text-forest hover:bg-sage/60",
  accent: "bg-leaf text-ivory shadow-soft hover:bg-leaf-deep",
  danger: "border-[1.5px] border-danger/40 text-danger hover:bg-danger/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-6 text-base",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export type ButtonProps = StyleProps & { loading?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
export type LinkButtonProps = StyleProps & { href: string; "aria-label"?: string; prefetch?: boolean };

export function buttonClasses({ variant = "primary", size = "md", className }: Omit<StyleProps, "children">) {
  return cn(base, variants[variant], sizes[size], className);
}

/** Renders a button, or a styled Next.js link when `href` is given. */
export function Button(props: ButtonProps | LinkButtonProps) {
  if ("href" in props) {
    const { href, variant, size, className, children, prefetch, ...rest } = props;
    return (
      <Link href={href} prefetch={prefetch} className={buttonClasses({ variant, size, className })} {...rest}>
        {children}
      </Link>
    );
  }
  const { variant, size, className, children, type = "button", loading = false, disabled, ...rest } = props;
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 rounded-full bg-current animate-bounce-dot" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      )}
      {children}
    </button>
  );
}
