import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { DoodleBookStack } from "@/components/illustrations/Doodles";
import { ArrowRightIcon } from "@/components/illustrations/Icons";

export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-2 sm:px-6" aria-labelledby="cta-title">
      <div className="relative grid items-center gap-8 overflow-hidden rounded-[1.5rem] bg-forest px-8 py-10 text-ivory sm:px-12 sm:py-14 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col gap-5">
          <span className="type-label text-sage">Ready when you are</span>
          <h2 id="cta-title" className="type-h2 text-ivory">
            Teach Pip something today.
          </h2>
          <p className="type-lead max-w-xl text-ivory/80">
            Pick a lesson, explain it in your own words, and find out which parts you can teach without looking anything
            up.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/topics" className={buttonClasses({ size: "lg", className: "bg-butter text-charcoal shadow-none hover:bg-butter-deep" })}>
              Start teaching
              <ArrowRightIcon className="size-5" />
            </Link>
            <Link href="/about" className={buttonClasses({ size: "lg", className: "border-[1.5px] border-ivory/50 text-ivory hover:bg-ivory/10" })}>
              About the project
            </Link>
          </div>
        </div>
        <DoodleBookStack className="size-44 justify-self-center text-ivory sm:size-52" />
      </div>
    </section>
  );
}
