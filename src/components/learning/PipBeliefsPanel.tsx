"use client";

import { useId } from "react";
import type { StudentBelief } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { BELIEF_STATUS, plural, STATUS_ORDER } from "./labels";

interface PipBeliefsPanelProps {
  /** From the turn response (`pip`) or GET /pip. Never includes correctness. */
  beliefs: StudentBelief[];
  learnerName?: string;
  className?: string;
}

/**
 * "What Pip believes": every belief the student may see, grouped by how settled
 * it is. Beliefs the latest message added or changed are highlighted (the
 * LearningStrip announces the change to screen readers, so this doesn't too).
 */
export function PipBeliefsPanel({ beliefs, learnerName = "Pip", className }: PipBeliefsPanelProps) {
  const titleId = useId();
  const changed = beliefs.filter((b) => b.changedThisTurn);
  const sorted = [...beliefs].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return (
    <section className={cn("card p-5", className)} aria-labelledby={titleId} data-testid="pip-beliefs">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="font-display text-xl text-charcoal">
          What {learnerName} believes
        </h2>
        {changed.length > 0 && (
          <span className="text-xs font-semibold text-forest">{plural(changed.length, "change")} just now</span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Nothing yet. As you teach, the ideas {learnerName} picks up from you show up here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {sorted.map((b) => {
            const status = BELIEF_STATUS[b.status];
            return (
              <li
                key={b.id}
                data-status={b.status}
                data-changed={b.changedThisTurn || undefined}
                className={cn(
                  "rounded-2xl border px-3.5 py-2.5 text-[14px] leading-relaxed text-charcoal/90",
                  b.changedThisTurn ? "animate-pop border-forest/50 bg-sage/40" : "border-line bg-paper",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={status.tone} title={status.hint}>{status.label}</Badge>
                  {b.startedWith && <span className="text-xs text-muted">Pip&rsquo;s own idea</span>}
                  {b.changedThisTurn && <span className="text-xs font-semibold text-forest">New</span>}
                </div>
                <p className="mt-1.5">&ldquo;{b.statement}&rdquo;</p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        This shows what {learnerName} took from you, not whether it&rsquo;s right. You&rsquo;ll see that after the session.
      </p>
    </section>
  );
}
