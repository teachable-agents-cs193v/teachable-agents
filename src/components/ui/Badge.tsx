import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "sage" | "butter" | "terracotta" | "forest" | "neutral" | "accent";

const tones: Record<Tone, string> = {
  sage: "bg-sage text-forest",
  butter: "bg-butter text-charcoal",
  terracotta: "bg-terracotta/15 text-terracotta-deep",
  forest: "bg-forest text-ivory",
  neutral: "bg-ivory-deep text-muted",
  accent: "accent-bg accent-text",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "sage", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
