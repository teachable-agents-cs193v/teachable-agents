import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * A small IBM Plex Mono label: eyebrows above headings, chapter numbers,
 * metadata. `tone="band"` sits it on a sage marker stroke.
 */
export function Eyebrow({
  tone = "leaf",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "leaf" | "muted" | "band" }) {
  return (
    <span
      className={cn(
        "type-label inline-flex items-center gap-2",
        tone === "leaf" && "text-leaf",
        tone === "muted" && "text-muted",
        tone === "band" && "band w-fit text-forest",
        className,
      )}
      {...props}
    />
  );
}
