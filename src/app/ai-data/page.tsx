import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CARD, DETAILS, GROQ_SOURCES, PROVIDER, SOURCES_CHECKED } from "@/lib/aiData";

export const metadata: Metadata = { title: "Your words and AI" };

/** The full explanation behind the "Where your words go" card. Public: readable before logging in. */
export default function AiDataPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-line/70 bg-paper">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-14 sm:px-6">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">{CARD.title}</span>
            <h1 className="font-display text-4xl text-forest sm:text-5xl">What happens to what you teach Pip</h1>
            <p className="text-lg leading-relaxed text-muted">
              AI Pip&rsquo;s replies are written by AI models that {PROVIDER} runs for us. Here is exactly what goes to{" "}
              {PROVIDER}, what doesn&rsquo;t, and what each of us keeps.
            </p>
          </div>
        </section>
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
          {DETAILS.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="font-display text-2xl text-charcoal">{section.heading}</h2>
              {section.body.map((paragraph, i) => (
                <p key={i} className="leading-relaxed text-charcoal/90">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc space-y-1 pl-6 leading-relaxed text-charcoal/90">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-ivory p-5">
            <h2 className="font-display text-xl text-charcoal">{PROVIDER}&rsquo;s own pages</h2>
            <p className="text-sm text-muted">What we say about {PROVIDER} comes from these pages, as we read them on {SOURCES_CHECKED}.</p>
            <ul className="flex flex-col gap-2 text-sm">
              {GROQ_SOURCES.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    className="focus-ring rounded font-medium text-forest underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
