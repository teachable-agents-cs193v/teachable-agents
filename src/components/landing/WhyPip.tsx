import { Eyebrow } from "@/components/ui/Eyebrow";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { DoodleCheckbox, DoodleTicks } from "@/components/illustrations/Doodles";

const PAIRS: Array<[tutor: string, pip: string]> = [
  ["An AI tutor explains the answer to you.", "Pip asks you to explain it, in your own words."],
  ["A tutor is always right.", "Pip gets things wrong in believable ways. Catching the mistake is the work."],
  ["A tutor tells you how you did.", "You notice for yourself where your explanation runs out. That's the part worth studying."],
];

export function WhyPip() {
  return (
    <section className="border-y border-sage bg-sage/45" aria-labelledby="why-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <Eyebrow>Why Pip is different</Eyebrow>
          <h2 id="why-title" className="type-h2 text-forest">
            Pip is a student you teach, not a tutor that hands you answers.
          </h2>
          <p className="type-lead text-charcoal/85">
            Explaining an idea out loud is the fastest way to find the part you don&rsquo;t understand yet. Pip is built to
            make you do exactly that.
          </p>
          <div className="flex items-center gap-4 rounded-2xl border border-sage-deep bg-paper p-4">
            <div className="relative">
              <LearnerAvatar mood="curious" size={72} />
              <DoodleTicks className="absolute -right-3 -top-3 size-7 text-leaf" />
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Pip asks, gets things wrong, and only ends up knowing what you manage to explain.
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-4">
          {PAIRS.map(([tutor, pip]) => (
            <li key={pip} className="card grid gap-4 p-5 sm:grid-cols-2 sm:gap-6">
              <div className="flex flex-col gap-1.5">
                <span className="type-label text-muted">A tutor</span>
                <span className="text-muted line-through decoration-leaf/70 decoration-2">{tutor}</span>
              </div>
              <div className="flex items-start gap-3">
                <DoodleCheckbox className="mt-0.5 size-7 shrink-0 text-charcoal" />
                <div className="flex flex-col gap-1.5">
                  <span className="type-label text-leaf">Pip</span>
                  <span className="font-medium text-charcoal">{pip}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
