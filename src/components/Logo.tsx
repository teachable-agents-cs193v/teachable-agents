import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Protégé wordmark: Space Grotesk, deep green, with a hand-drawn sprout
 * and the tile's little excitement ticks. Protégé is the platform; Pip is the
 * student you teach.
 */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("focus-ring inline-flex items-center gap-2 rounded-md", className)} aria-label="Protégé home">
      <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
        <path d="M22 44c-.6-9.6 1-17.6 4.8-25" fill="none" stroke="#222222" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M27.4 18.4c2.4-7.6 8-11.2 16-11-1.6 7.8-7.2 12.2-16 11z" fill="#4d8b6a" stroke="#222222" strokeWidth="2" strokeLinejoin="round" />
        <path d="M25 24.6c-4.6-4.4-10.2-5.6-16.4-4 2.8 6 8.6 8.2 16.4 4z" fill="#dde9df" stroke="#222222" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 44.6c8.6-1.2 17.4-1.2 26 0" fill="none" stroke="#222222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 10l3.2 3.4M3.6 20h4.2" fill="none" stroke="#4d8b6a" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className={cn("font-display text-[1.35rem] font-bold tracking-tight text-forest", compact && "hidden sm:inline")}>
        Protégé
      </span>
    </Link>
  );
}
