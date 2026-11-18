import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "paper" | "sage" | "mint";

const tones: Record<Tone, string> = {
  paper: "card",
  sage: "card-sage",
  mint: "rounded-card border border-sage bg-mint",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Paper for content, sage for selected or featured, mint for quiet panels. */
  tone?: Tone;
  /** Lifts slightly on hover, for cards that are links. */
  interactive?: boolean;
}

export function Card({ tone = "paper", interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(tones[tone], interactive && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift", className)}
      {...props}
    />
  );
}
