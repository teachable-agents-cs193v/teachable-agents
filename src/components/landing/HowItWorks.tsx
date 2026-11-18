import type { ComponentType, SVGProps } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DoodleArrow, DoodleBookOpen, DoodleLightbulb, DoodleQuestionBubble } from "@/components/illustrations/Doodles";

interface Step {
  title: string;
  text: string;
  /** A hand-written aside, like a note in the margin. */
  note: string;
  Doodle: ComponentType<SVGProps<SVGSVGElement>>;
}

const STEPS: Step[] = [
  {
    title: "Choose a concept",
    text: "Select a topic you want to understand better.",
    note: "something you half-know works best",
    Doodle: DoodleBookOpen,
  },
  {
    title: "Teach Pip",
    text: "Explain concepts to Pip, respond to questions, and work through misconceptions.",
    note: "Pip will push back",
    Doodle: DoodleQuestionBubble,
  },
  {
    title: "See what Pip learned",
    text: "Watch how Pip's understanding changes and reflect on your own learning.",
    note: "no grades, just a mirror",
    Doodle: DoodleLightbulb,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20" aria-labelledby="how-title">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title={<span id="how-title">Three steps, one curious student.</span>}
          description="A session takes ten to fifteen minutes. You do the explaining; Pip does the asking."
          align="center"
          className="mx-auto"
        />
        <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card relative flex flex-col gap-5 p-7">
              <div className="flex items-start justify-between gap-4">
                <span className="band font-mono text-base font-medium text-forest">0{i + 1}</span>
                <step.Doodle className="size-14 shrink-0 text-charcoal" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="type-h3 text-forest">{step.title}</h3>
                <p className="leading-relaxed text-muted">{step.text}</p>
              </div>
              <p className="mt-auto font-mono text-xs text-leaf">↳ {step.note}</p>
              {i < STEPS.length - 1 && (
                <DoodleArrow
                  className="absolute -right-9 top-1/2 z-10 hidden size-12 -translate-y-1/2 text-leaf md:block"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
