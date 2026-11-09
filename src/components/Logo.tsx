import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("focus-ring inline-flex items-center gap-2 rounded-md", className)}
      aria-label="Protégé home"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-forest text-ivory">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 20c0-6 3-9 8-10-1 5-3 8-8 10z" fill="#dde9dc" />
          <path d="M12 20c0-6-3-9-8-10 1 5 3 8 8 10z" fill="#f4e8b4" />
          <path d="M12 20V11" stroke="#faf8f3" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className={cn("font-display text-xl tracking-tight text-forest", compact && "hidden sm:inline")}>Protégé</span>
    </Link>
  );
}
