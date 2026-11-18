"use client";

import type { LearningFlag } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LearningFlagsProps {
  /** `progress.flags`: about the latest message only. */
  flags: LearningFlag[];
  learnerName?: string;
  className?: string;
}

/**
 * Side notes under the conversation, never said by Pip: Pip just said one of its wrong ideas,
 * or the student just taught one. They say something isn't right, never what the right answer is,
 * so catching and fixing it is still the student's work.
 */
export function LearningFlags({ flags, learnerName = "Pip", className }: LearningFlagsProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)} aria-label="Heads up" aria-live="polite" data-testid="learning-flags">
      {flags.map((flag) =>
        flag.kind === "pip_wrong_idea" ? (
          <p key={`p-${flag.beliefId}`} className="rounded-2xl border border-terracotta/40 bg-terracotta/10 px-4 py-2.5 text-sm text-charcoal">
            <span className="font-semibold">Catch it:</span> {learnerName} just said something that isn&rsquo;t right: &ldquo;{flag.statement}&rdquo;
            {" "}Can you show {learnerName} why?
          </p>
        ) : (
          <p key={`t-${flag.beliefId}`} className="rounded-2xl border border-butter bg-butter/30 px-4 py-2.5 text-sm text-charcoal">
            <span className="font-semibold">Heads up:</span> what you just taught {flag.verdict === "wrong" ? "isn't right" : "is only partly right"}: &ldquo;{flag.statement}&rdquo;
            {" "}{learnerName} believes it now. See if you can work out what&rsquo;s off.
          </p>
        ),
      )}
    </section>
  );
}
