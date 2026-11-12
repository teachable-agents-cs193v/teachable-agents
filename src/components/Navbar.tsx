"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";
import { Logo } from "./Logo";
import { AuthNavControl } from "./auth/AuthNavControl";
import { cn } from "@/lib/utils";

const links = [
  { href: "/topics", label: "Topics" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/sessions", label: "My sessions" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname === link.href.split("#")[0] && !link.href.includes("#");
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring rounded-full px-4 py-2 text-[15px] font-medium text-charcoal/80 transition-colors hover:bg-sage/50 hover:text-forest",
                    active && "bg-sage text-forest",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="hidden md:flex md:items-center md:gap-3">
          <AuthNavControl />
          <Button href="/topics" size="sm">
            Start Teaching
          </Button>
        </div>
        <button
          type="button"
          className="focus-ring grid size-10 place-items-center rounded-full text-forest hover:bg-sage/50 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>
      {open && (
        <div id="mobile-nav" className="border-t border-line/70 bg-ivory px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring block rounded-xl px-3 py-2.5 font-medium text-charcoal hover:bg-sage/50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <AuthNavControl layout="menu" onNavigate={() => setOpen(false)} />
            </li>
            <li className="pt-2">
              <Button href="/topics" className="w-full">
                Start Teaching
              </Button>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
