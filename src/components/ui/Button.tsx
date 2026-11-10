import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "bg-forest text-ivory hover:bg-forest-deep shadow-soft hover:shadow-lift",
  secondary: "bg-sage text-forest hover:bg-sage-deep",
  outline: "border border-forest/30 bg-transparent text-forest hover:border-forest hover:bg-sage/40",
  ghost: "text-forest hover:bg-sage/50",
  accent: "bg-terracotta text-ivory hover:bg-terracotta-deep shadow-soft",
  danger: "border border-danger/30 text-danger hover:bg-danger/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export type ButtonProps = StyleProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
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
  const { variant, size, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}
