import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  DoodleBookStack,
  DoodleCheckbox,
  DoodleLightbulb,
  DoodleQuestionBubble,
  DoodleStar,
  DoodleTicks,
} from "@/components/illustrations/Doodles";
import { ArrowRightIcon } from "@/components/illustrations/Icons";
import { startTeachingHref } from "./startTeachingHref";

/**
 * The landing hero: a mint panel on graph paper, the headline with a drawn
 * underline, and beside it a lesson plan on ruled paper with a sticky note.
 * The composition is made of the product's own objects and the tile's
 * doodles rather than a character drawing.
 */
export function Hero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10" aria-labelledby="hero-title">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-sage bg-mint">
        <div
          className="grid-paper absolute inset-0 opacity-80 [mask-image:linear-gradient(to_left,black_20%,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-14 lg:py-16">
          <div className="flex flex-col gap-6 animate-fade-up">
            <Eyebrow tone="band">A teachable agent</Eyebrow>
            <h1 id="hero-title" className="type-display text-forest">
              You teach.
              <br />
              <span className="sketch-underline">Pip learns.</span>
              <DoodleTicks className="ml-1 inline-block size-9 -translate-y-4 text-leaf sm:size-11" />
            </h1>
            <p className="type-lead max-w-xl text-charcoal/85">
              Meet Pip, a curious student who learns from your explanations. Teach a concept, catch Pip&rsquo;s
              misconceptions, and find out what you understand along the way.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button href={startTeachingHref(loggedIn)} size="lg">
                Start teaching
                <ArrowRightIcon className="size-5" />
              </Button>
              <Button href="#how-it-works" variant="outline" size="lg">
                How it works
              </Button>
            </div>
            <p className="text-sm text-muted">Free for students. Teaching needs an account, so Pip can remember what you taught.</p>
          </div>

          <LessonPlanScene />
        </div>
      </div>
    </section>
  );
}

/** The plan written on the page. Decorative: the real lesson is in the library. */
const PLAN = [
  { text: "Coins and dice first", done: true },
  { text: "Multiplication rule", done: true },
  { text: "Exclusive \u2260 independent", done: false },
];

/**
 * A lesson plan on ruled notebook paper, a butter sticky note pinned over its
 * corner, and a few doodles from the toolkit. Everything is sized relative to
 * the column, so it scales from phone to desktop without a fixed canvas.
 */
function LessonPlanScene() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-10 pr-5 pt-10 animate-pop sm:pr-6" aria-hidden="true">
      {/* behind the page: a stack of books peeking out at the bottom left */}
      <DoodleBookStack className="absolute -bottom-1 left-0 size-20 text-charcoal sm:size-24" />

      <div className="paper-lines relative w-[92%] -rotate-2 rounded-2xl border border-sage-deep pb-14 pl-12 pr-4 pt-7 shadow-lift sm:w-[84%] sm:pl-14 sm:pr-6">
        <span className="band absolute -top-3 left-12 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-forest">
          Lesson plan
        </span>
        <p className="font-mono text-xs uppercase leading-[1.9rem] tracking-[0.12em] text-leaf">Today, teach Pip</p>
        <p className="font-display text-lg font-semibold leading-[1.9rem] text-forest sm:text-xl">Independence vs. mutual exclusivity</p>
        <ul className="mt-[1.9rem] flex flex-col">
          {PLAN.map((item) => (
            <li key={item.text} className="flex items-center gap-2 text-[13px] leading-[1.9rem] text-charcoal sm:gap-2.5 sm:text-[15px]">
              <DoodleCheckbox checked={item.done} className="size-6 shrink-0 text-charcoal" />
              <span className={item.done ? undefined : "text-charcoal/70"}>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* the sticky note from the tile, pinned over the page's corner */}
      <div className="absolute -bottom-3 right-0 w-[54%] rotate-3 rounded-2xl bg-butter px-5 py-4 shadow-soft sm:bottom-0 sm:w-[50%]">
        <DoodleStar className="absolute -left-4 -top-4 size-9 text-charcoal" />
        <DoodleTicks className="absolute -right-2 -top-3 size-8 text-leaf" />
        <p className="font-display text-lg font-semibold leading-snug text-charcoal">Pip learned something new!</p>
      </div>

      <DoodleQuestionBubble className="absolute right-[2%] top-0 size-16 rotate-6 text-charcoal sm:size-20" />
      <DoodleLightbulb className="absolute right-0 top-[42%] size-12 rotate-12 text-charcoal sm:size-14" />
    </div>
  );
}
