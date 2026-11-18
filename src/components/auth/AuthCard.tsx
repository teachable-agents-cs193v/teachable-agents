import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/** Shared frame for the login and signup screens. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl text-forest">{title}</h1>
      <p className="mt-2 text-muted">{subtitle}</p>
      <Card className="mt-8 p-6 sm:p-8">{children}</Card>
    </section>
  );
}
