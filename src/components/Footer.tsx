import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line/70 bg-ivory-deep/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-sm text-muted">
            Teachable Agents and the Protégé Effect. A Stanford CS193V final project exploring
            learning by teaching.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-forest">
          <li><Link className="focus-ring rounded hover:underline" href="/topics">Topics</Link></li>
          <li><Link className="focus-ring rounded hover:underline" href="/#how-it-works">How it works</Link></li>
          <li><Link className="focus-ring rounded hover:underline" href="/#meet-pip">Meet Pip</Link></li>
          <li><Link className="focus-ring rounded hover:underline" href="/sessions">My sessions</Link></li>
        </ul>
      </div>
    </footer>
  );
}
