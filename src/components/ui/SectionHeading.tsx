import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  /** Draws the sage marker band behind the title, like the tile's section labels. */
  band?: boolean;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "left", band = false, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" && "items-center text-center", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className={cn("type-h2 text-forest", band && "band w-fit")}>{title}</h2>
      {description && <p className="type-lead max-w-2xl text-muted">{description}</p>}
    </div>
  );
}
