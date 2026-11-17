import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PipThinkingScene } from "@/components/illustrations/Pip";
import { DoodleQuestionBubble, DoodleStar, DoodleTicks } from "@/components/illustrations/Doodles";
import { ArrowRightIcon } from "@/components/illustrations/Icons";

/** The landing hero from the style tile: a mint panel, the headline with a drawn underline, Pip thinking beside a stack of books. */
export function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10" aria-labelledby="hero-title">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-sage bg-mint">
        <div
          className="grid-paper absolute inset-0 opacity-80 [mask-image:linear-gradient(to_left,black_20%,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-14 lg:py-16">
          <div className="flex flex-col gap-6 animate-fade-up">
            <Eyebrow tone="band">A teachable agent</Eyebrow>
            <h1 id="hero-title" className="type-display text-forest">
              You teach.
              <br />
              <span className="sketch-underline">Pip learns.</span>
              <DoodleTicks className="ml-1 inline-block size-9 -translate-y-4 text-leaf sm:size-11" />
            </h1>
            <p className="type-lead max-w-xl text-charcoal/85">
              Meet Pip, a curious student who learns from your explanations. Teach concepts, challenge
              misconceptions, and discover what you understand along the way.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button href="/topics" size="lg">
                Start teaching
                <ArrowRightIcon className="size-5" />
              </Button>
              <Button href="#how-it-works" variant="outline" size="lg">
                How it works
              </Button>
            </div>
            <p className="text-sm text-muted">Free for students. Make an account to save your sessions and come back to them.</p>
          </div>

          <div className="relative mx-auto w-full max-w-[580px] animate-pop">
            <PipThinkingScene className="w-full" />
            <DoodleQuestionBubble className="absolute -left-1 top-0 size-12 -rotate-6 text-charcoal sm:size-14" />
            <DoodleStar className="absolute bottom-10 right-0 size-9 rotate-12 text-charcoal" />
          </div>
        </div>
      </div>
    </section>
  );
}
