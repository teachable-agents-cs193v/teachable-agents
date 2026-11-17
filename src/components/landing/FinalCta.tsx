import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DoodleBookStack, DoodleTicks } from "@/components/illustrations/Doodles";
import { ArrowRightIcon } from "@/components/illustrations/Icons";
import { startTeachingHref } from "./startTeachingHref";

/**
 * The closing call to action: the same mint panel as the hero, so the page
 * opens and closes on the same note, with dark text and the standard primary
 * button so the action is unmistakable.
 */
export function FinalCta({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6" aria-labelledby="cta-title">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-sage-deep bg-mint">
        <div
          className="grid-paper absolute inset-0 opacity-80 [mask-image:linear-gradient(to_left,black_20%,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-10 px-8 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-6">
            <Eyebrow tone="band">Ready when you are</Eyebrow>
            <h2 id="cta-title" className="type-h2 text-forest">
              Teach Pip something <span className="sketch-underline">today.</span>
            </h2>
            <p className="type-lead max-w-xl text-charcoal/85">
              Pick a lesson, explain it in your own words, and find out which parts you can teach without looking anything
              up.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button href={startTeachingHref(loggedIn)} size="lg">
                Start teaching
                <ArrowRightIcon className="size-5" />
              </Button>
              <Button href="/about" variant="outline" size="lg">
                About the project
              </Button>
            </div>
          </div>
          <div className="relative justify-self-center" aria-hidden="true">
            <DoodleBookStack className="size-44 text-charcoal sm:size-56" />
            <DoodleTicks className="absolute -right-3 top-3 size-10 text-leaf" />
          </div>
        </div>
      </div>
    </section>
  );
}
