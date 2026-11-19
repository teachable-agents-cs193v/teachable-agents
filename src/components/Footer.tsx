import Link from "next/link";
import { Logo } from "./Logo";
import { DoodleBookOpen } from "./illustrations/Doodles";

const links = [
  { href: "/topics", label: "Lessons" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/sessions", label: "My sessions" },
  { href: "/ai-data", label: "Your data and AI" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-ivory-deep/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Learn by teaching Pip. A Stanford CS193V final project on teachable agents and the protégé effect.
          </p>
        </div>
        <nav aria-label="Footer" className="flex items-start gap-6">
          <DoodleBookOpen className="hidden size-10 text-charcoal sm:block" />
          <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm font-medium text-forest">
            {links.map((link) => (
              <li key={link.href}>
                <Link className="focus-ring rounded hover:underline hover:decoration-leaf hover:decoration-2 hover:underline-offset-4" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
