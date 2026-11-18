import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Small status tags. Butter is reserved for "in progress" style highlights. */
type Tone = "sage" | "mint" | "butter" | "leaf" | "forest" | "neutral" | "accent";

const tones: Record<Tone, string> = {
  sage: "bg-sage text-forest",
  mint: "bg-mint text-forest border border-sage-deep",
  butter: "bg-butter text-charcoal",
  leaf: "bg-leaf/15 text-leaf-deep",
  forest: "bg-forest text-ivory",
  neutral: "bg-ivory-deep text-muted",
  accent: "accent-bg accent-text",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Mono, uppercase: for metadata like lesson numbers. */
  mono?: boolean;
}

export function Badge({ tone = "sage", mono = false, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
        mono ? "font-mono uppercase tracking-[0.1em] font-medium" : "tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
