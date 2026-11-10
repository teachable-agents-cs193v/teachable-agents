import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "left", className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" && "items-center text-center", className)}>
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">{eyebrow}</span>
      )}
      <h2 className="font-display text-3xl leading-tight text-forest sm:text-4xl">{title}</h2>
      {description && <p className="max-w-2xl text-lg leading-relaxed text-muted">{description}</p>}
    </div>
  );
}
