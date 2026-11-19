"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export interface NavLink {
  href: string;
  label: string;
}

interface NavBarProps {
  links: NavLink[];
  loggedIn: boolean;
  /** The auth control for the desktop bar (login / signup, or greeting / logout). */
  control: ReactNode;
  /** The same control, stacked for the mobile menu. */
  menuControl: ReactNode;
}

/**
 * The bar itself: a client component only for the active-link underline and
 * the mobile menu. Which links it shows is decided by SiteNav on the server.
 */
export function NavBar({ links, loggedIn, control, menuControl }: NavBarProps) {
  const pathname = usePathname();
  // The menu remembers which path it was opened on, so a route change closes it
  // without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

  const isActive = (href: string) => !href.includes("#") && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/95">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6" aria-label="Main">
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring relative rounded-lg px-3.5 py-2 text-[15px] font-medium text-charcoal/85 transition-colors hover:text-forest",
                    // the tile's loose green underline under the current page
                    "after:absolute after:inset-x-3 after:-bottom-0.5 after:h-[3px] after:rounded-full after:bg-leaf after:opacity-0 after:transition-opacity",
                    active && "text-forest after:opacity-100",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="hidden md:flex md:items-center md:gap-3">{control}</div>
        <button
          type="button"
          className="focus-ring grid size-10 place-items-center rounded-lg text-forest hover:bg-sage/60 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>
      {open && (
        <div id="mobile-nav" className="border-t border-line bg-ivory px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "focus-ring block rounded-lg px-3 py-2.5 font-medium text-charcoal hover:bg-sage/60",
                    isActive(link.href) && "bg-sage text-forest",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {!loggedIn && (
              <li>
                <Link href="/topics" onClick={() => setOpen(false)} className="focus-ring block rounded-lg px-3 py-2.5 font-medium text-charcoal hover:bg-sage/60">
                  Lessons
                </Link>
              </li>
            )}
            <li className="border-t border-line pt-3 mt-1">{menuControl}</li>
          </ul>
        </div>
      )}
    </header>
  );
}
