"use client";

import { useId } from "react";
import type { LearningReview, ReviewMisconception } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { QuestionIcon, SparkleIcon } from "@/components/illustrations/Icons";
import { CORRECTNESS, EVENT_DOT, eventLabel, messageLabel, plural } from "./labels";

interface LearningReviewPanelProps {
  /** From GET /api/sessions/[id]/review, once the session has ended. */
  review: LearningReview;
  learnerName?: string;
  className?: string;
}

/**
 * The end-of-session review: which of Pip's starting ideas the student changed,
 * what they taught (with the AI assessor's verdict, now the session is over),
 * and what each message changed.
 */
export function LearningReviewPanel({ review, learnerName = "Pip", className }: LearningReviewPanelProps) {
  const ids = { misconceptions: useId(), taught: useId(), timeline: useId() };
  const { metrics } = review;
  const withReason = metrics.teaching.explained + metrics.teaching.explainedLater;

  return (
    <div className={cn("flex flex-col gap-6", className)} data-testid="learning-review">
      <section className="grid gap-4 sm:grid-cols-3" aria-label="What changed for Pip">
        <ReviewStat
          label="Ideas changed"
          value={`${metrics.misconceptions.corrected} of ${metrics.misconceptions.total}`}
          detail={`Starting ideas you changed ${learnerName}'s mind about`}
        />
        <ReviewStat label="Ideas taught" value={String(metrics.teaching.claims)} detail={`${withReason} with a reason or example`} />
        <ReviewStat
          label="Taught correctly"
          value={`${metrics.correctness.correct} of ${review.taught.length}`}
          detail={metrics.correctness.partly ? `${metrics.correctness.partly} partly right` : "As judged by the AI assessor"}
        />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6" aria-labelledby={ids.misconceptions}>
          <h2 id={ids.misconceptions} className="flex items-center gap-2 font-display text-2xl text-charcoal">
            <QuestionIcon className="size-5 text-terracotta" /> {learnerName}&rsquo;s starting ideas
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {review.misconceptions.map((m) => (
              <li key={m.id} data-outcome={m.outcome} className="rounded-2xl border border-line bg-paper px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={m.outcome === "corrected" ? "forest" : "terracotta"}>
                    {m.outcome === "corrected" ? "Corrected" : "Still believes"}
                  </Badge>
                  {!m.voiced && m.outcome === "still_held" && <span className="text-xs text-muted">Didn&rsquo;t come up</span>}
                </div>
                <p className="mt-2 font-medium text-charcoal">{m.label}</p>
                <p className="mt-1 text-sm text-muted">{learnerName} {m.voiced ? "said" : "believed"}: &ldquo;{m.statement}&rdquo;</p>
                <p className="mt-1 text-xs text-muted">{misconceptionDetail(m, learnerName)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6" aria-labelledby={ids.taught}>
          <h2 id={ids.taught} className="flex items-center gap-2 font-display text-2xl text-charcoal">
            <SparkleIcon className="size-5 text-terracotta" /> What you taught
          </h2>
          {review.taught.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{learnerName} didn&rsquo;t take on any new ideas this time.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {review.taught.map((t) => {
                const verdict = CORRECTNESS[t.correctness];
                return (
                  <li key={t.id} data-correctness={t.correctness} className="rounded-2xl border border-line bg-paper px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={verdict.tone}>{verdict.label}</Badge>
                      <span className="text-xs text-muted">
                        {t.status === "understood" ? "With a reason" : "No reason given"} · your {messageLabel(t.turn)}
                      </span>
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-charcoal/90">&ldquo;{t.statement}&rdquo;</p>
                    {t.concept && <p className="mt-1 text-xs text-muted">About: {t.concept}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            The verdicts come from the AI that checked your teaching against the topic. It can be wrong, so look again at
            anything that surprises you.
          </p>
        </section>
      </div>

      {review.timeline.length > 0 && (
        <section className="card p-6" aria-labelledby={ids.timeline}>
          <details>
            <summary className="focus-ring cursor-pointer rounded-lg">
              <h2 id={ids.timeline} className="inline font-display text-2xl text-charcoal">
                Message by message
              </h2>
            </summary>
            <ol className="mt-4 flex flex-col gap-4">
              {review.timeline.map((entry) => (
                <li key={entry.turn}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Your {messageLabel(entry.turn)}</p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {entry.events.map((e, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-charcoal/90">
                        <span aria-hidden="true" className={cn("mt-2 size-2.5 shrink-0 rounded-full", EVENT_DOT[e.type])} />
                        <span>
                          <span className="font-medium">{eventLabel(e)}:</span> &ldquo;{e.statement}&rdquo;
                          {e.type === "learned" && e.correctness && (
                            <span className="ml-1 text-sm text-muted">({CORRECTNESS[e.correctness].label.toLowerCase()})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {review.recordedFromTurn > 0 && (
              <p className="mt-4 text-xs text-muted">This session started before the timeline existed, so it begins at your {messageLabel(review.recordedFromTurn)}.</p>
            )}
          </details>
        </section>
      )}
    </div>
  );
}

function ReviewStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card flex flex-col gap-1 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="font-display text-3xl text-forest">{value}</p>
      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}

function misconceptionDetail(m: ReviewMisconception, learnerName: string): string {
  const tries = m.attempts.length;
  if (m.outcome === "corrected") {
    if (m.correctedAtTurn === null) return "Changed its mind.";
    const after = m.turnsToCorrect !== null ? `, ${plural(m.turnsToCorrect, "message")} after ${learnerName} said it` : "";
    return `Changed its mind at your ${messageLabel(m.correctedAtTurn)}${after}${tries > 1 ? ` (${plural(tries, "try", "tries")})` : ""}.`;
  }
  if (tries === 0) return m.voiced ? "You didn't respond to this one." : `${learnerName} never said this one out loud.`;
  const explained = m.attempts.filter((a) => a.explained).length;
  return `You responded ${plural(tries, "time")}; ${explained === 0 ? "none of them said why it's wrong" : "it wasn't quite enough to change its mind"}.`;
}
