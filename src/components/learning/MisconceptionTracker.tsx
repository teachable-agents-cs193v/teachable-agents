"use client";

import { useId } from "react";
import type { ProgressMisconception } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { BELIEF_STATUS, messageLabel, plural } from "./labels";

interface MisconceptionTrackerProps {
  /** `progress.misconceptions`: only ones Pip has said out loud or been talked out of. */
  misconceptions: ProgressMisconception[];
  /** `progress.studentTurns`, to highlight what the latest message changed. */
  studentTurns: number;
  learnerName?: string;
  className?: string;
}

/**
 * The misconception tracker: ideas Pip started out with, once it has said them,
 * and whether the student has changed its mind. Worded neutrally on purpose:
 * during the session it never says an idea is wrong, so the student has to judge.
 */
export function MisconceptionTracker({ misconceptions, studentTurns, learnerName = "Pip", className }: MisconceptionTrackerProps) {
  const titleId = useId();
  const latest = studentTurns - 1;
  const changedMind = misconceptions.filter((m) => m.status === "changed_mind").length;

  return (
    <section className={cn("card p-5", className)} aria-labelledby={titleId} data-testid="misconception-tracker">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="font-display text-xl text-charcoal">
          Ideas {learnerName} came in with
        </h2>
        {misconceptions.length > 0 && (
          <span className="text-xs text-muted">
            {changedMind} of {misconceptions.length} changed
          </span>
        )}
      </div>

      {misconceptions.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {learnerName} hasn&rsquo;t shared any of its own ideas about this yet. Listen for them as you teach.
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
                <Badge tone={status.tone}>{status.label}</Badge>
                <p className="mt-1.5 text-charcoal/90">&ldquo;{m.statement}&rdquo;</p>
                <p className="mt-1 text-xs text-muted">{detail(m)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function detail(m: ProgressMisconception): string {
  if (m.status === "changed_mind") {
    if (m.turnsToChange !== null) return `Changed its mind ${plural(m.turnsToChange, "message")} after saying it.`;
    if (m.changedAtTurn !== null) return `Changed its mind at your ${messageLabel(m.changedAtTurn)}.`;
    return "Changed its mind.";
  }
  if (m.attempts === 0) return "Pip started out thinking this. Do you agree with it?";
  return `You've responded to it ${plural(m.attempts, "time")}, and Pip hasn't changed its mind yet.`;
}
