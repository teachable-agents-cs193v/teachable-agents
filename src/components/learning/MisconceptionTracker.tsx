"use client";

import { useId } from "react";
import type { LearningProgress, ProgressMisconception } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { BELIEF_STATUS, messageLabel, plural } from "./labels";

interface MisconceptionTrackerProps {
  /** `progress.misconceptions`: only ones Pip has said out loud or been talked out of. */
  misconceptions: ProgressMisconception[];
  /** `progress.wrongTaught`: wrong ideas the student taught that Pip now holds. */
  wrongTaught?: LearningProgress["wrongTaught"];
  /** `progress.studentTurns`, to highlight what the latest message changed. */
  studentTurns: number;
  learnerName?: string;
  className?: string;
}

/**
 * The misconception tracker: wrong ideas Pip holds, so the student knows what to catch.
 * Pip's own starting ideas appear once it has said them; ideas the student taught appear
 * when the assessor judged them wrong. It says an idea isn't right, never what the right one is.
 * Pip itself never says any of this.
 */
export function MisconceptionTracker({ misconceptions, wrongTaught = [], studentTurns, learnerName = "Pip", className }: MisconceptionTrackerProps) {
  const titleId = useId();
  const latest = studentTurns - 1;
  const changedMind = misconceptions.filter((m) => m.status === "changed_mind").length;

  return (
    <section className={cn("card p-5", className)} aria-labelledby={titleId} data-testid="misconception-tracker">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="font-display text-xl text-charcoal">
          Wrong ideas to catch
        </h2>
        {misconceptions.length > 0 && (
          <span className="text-xs text-muted">
            {changedMind} of {misconceptions.length} changed
          </span>
        )}
      </div>

      {misconceptions.length === 0 && wrongTaught.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {learnerName} came in with a few wrong ideas about this. When it says one, it shows up here so you can catch it.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {misconceptions.map((m) => {
            const justChanged = m.changedAtTurn === latest || (m.status === "believes" && m.voicedAtTurn === latest);
            const status = BELIEF_STATUS[m.status];
            return (
              <li
                key={m.id}
                data-status={m.status}
                className={cn(
                  "rounded-2xl border px-3.5 py-2.5 text-[14px] leading-relaxed",
                  justChanged ? "animate-pop border-forest/50 bg-sage/40" : "border-line bg-paper",
                )}
              >
                <Badge tone={m.status === "changed_mind" ? "forest" : "leaf"}>{m.status === "changed_mind" ? "Fixed" : "Not right"}</Badge>
                <span className="sr-only"> ({status.label})</span>
                <p className="mt-1.5 text-charcoal/90">&ldquo;{m.statement}&rdquo;</p>
                <p className="mt-1 text-xs text-muted">{detail(m, learnerName)}</p>
              </li>
            );
          })}
          {wrongTaught.map((w) => (
            <li
              key={w.id}
              data-status="taught_wrong"
              className={cn(
                "rounded-2xl border px-3.5 py-2.5 text-[14px] leading-relaxed",
                w.turn === latest ? "animate-pop border-leaf/50 bg-leaf/10" : "border-line bg-paper",
              )}
            >
              <Badge tone={w.fixed ? "forest" : "butter"}>{w.fixed ? "Fixed" : w.verdict === "wrong" ? "You taught this" : "Partly right"}</Badge>
              <p className="mt-1.5 text-charcoal/90">&ldquo;{w.statement}&rdquo;</p>
              <p className="mt-1 text-xs text-muted">
                {w.fixed
                  ? `You took this back, so ${learnerName} dropped it.`
                  : `${w.verdict === "wrong" ? "This isn't right" : "This is only partly right"}, and ${learnerName} believes it now. Can you work out what's off and fix it?`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function detail(m: ProgressMisconception, learnerName: string): string {
  if (m.status === "changed_mind") {
    if (m.turnsToChange !== null) return `Changed its mind ${plural(m.turnsToChange, "message")} after saying it.`;
    if (m.changedAtTurn !== null) return `Changed its mind at your ${messageLabel(m.changedAtTurn)}.`;
    return "Changed its mind.";
  }
  if (m.attempts === 0) return `${learnerName} believes this, but it isn't right. Help ${learnerName} see why.`;
  return `You've responded to it ${plural(m.attempts, "time")}, and ${learnerName} hasn't changed its mind yet. Try explaining why, with an example.`;
}
