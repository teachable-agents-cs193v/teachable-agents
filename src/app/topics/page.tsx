import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TopicLibrary } from "@/components/screens/TopicLibrary";
import { BookIcon } from "@/components/illustrations/Icons";

export const metadata: Metadata = { title: "Topic library" };

export default function TopicsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-line/70 bg-paper">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
              <BookIcon className="size-4" /> The library
            </span>
            <h1 className="font-display text-4xl text-forest sm:text-5xl">What will you teach today?</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted">
              Each shelf holds a concept students commonly half-understand. Pick one, meet Pip, and
              find out how well you can explain it.
            </p>
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <TopicLibrary />
        </section>
      </main>
      <Footer />
    </>
  );
}
