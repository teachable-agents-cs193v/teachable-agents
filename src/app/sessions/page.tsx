import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SessionsDashboard } from "@/components/screens/SessionsDashboard";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "My sessions" };

export default async function SessionsPage() {
  await requireUser("/sessions");
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-line/70 bg-paper">
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 py-14 sm:px-6">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Your teaching log</span>
              <h1 className="font-display text-4xl text-forest sm:text-5xl">Past sessions</h1>
              <p className="max-w-xl text-lg text-muted">Every lesson you have given Pip, with your reflections attached.</p>
            </div>
            <Button href="/topics">Teach something new</Button>
          </div>
        </section>
        <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
          <SessionsDashboard />
        </section>
      </main>
      <Footer />
    </>
  );
}
