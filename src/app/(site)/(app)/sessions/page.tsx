import type { Metadata } from "next";
import { SessionsDashboard } from "@/components/screens/SessionsDashboard";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "My sessions" };

export default async function SessionsPage() {
  await requireUser("/sessions");
  return (
    <>
      <section className="border-b border-sage bg-mint">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-3">
            <Eyebrow>Your teaching log</Eyebrow>
            <h1 className="type-h1 text-forest">Past sessions</h1>
            <p className="max-w-xl text-lg text-muted">Every lesson you have given Pip, with your reflections attached.</p>
          </div>
          <Button href="/topics">Teach something new</Button>
        </div>
      </section>
      <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <SessionsDashboard />
      </section>
    </>
  );
}
