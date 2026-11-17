import type { LearningProgress, TimelineEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EVENT_DOT, eventLabel, messageLabel, plural } from "./labels";

interface LearningStripProps {
  /** From the turn response (`progress`) or GET /progress. */
  progress: LearningProgress;
  learnerName?: string;
  className?: string;
}

/**
 * A small strip under the conversation: a few counts, what the latest message
 * changed, and one dot per student message showing what it changed.
 * Counts only, no score.
 */
export function LearningStrip({ progress, learnerName = "Pip", className }: LearningStripProps) {
  const { teaching, misconceptions, studentTurns } = progress;
  const byTurn = new Map(progress.timeline.map((e) => [e.turn, e]));
  const latest = studentTurns > 0 ? byTurn.get(studentTurns - 1) : undefined;
  const changedMind = misconceptions.filter((m) => m.status === "changed_mind").length;
  const turns = Array.from({ length: Math.max(0, studentTurns - progress.recordedFromTurn) }, (_, i) => progress.recordedFromTurn + i);

  return (
    <section className={cn("rounded-2xl border border-line bg-paper/80 px-4 py-3", className)} aria-label="Your teaching so far" data-testid="learning-strip">
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <Stat label="Ideas taught" value={teaching.claims} />
        <Stat label="With a reason" value={teaching.explained + teaching.explainedLater} detail={teaching.claims ? `of ${teaching.claims}` : undefined} />
        <Stat label={`${learnerName} changed its mind`} value={changedMind} />
      </dl>

      <p className="mt-2 text-sm text-charcoal/90" aria-live="polite">
        {studentTurns === 0
          ? `Start teaching, and you'll see here what each message changes for ${learnerName}.`
          : latest
            ? `Your last message: ${summarize(latest)}.`
            : `Your last message didn't change what ${learnerName} believes.`}
      </p>

      {turns.length > 0 && (
        <ol className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="What each of your messages changed">
          {turns.map((turn) => {
            const entry = byTurn.get(turn);
            const label = `Your ${messageLabel(turn)}: ${entry ? summarize(entry) : "no change"}`;
            return (
              <li key={turn} title={label} className="flex items-center gap-0.5">
                <span className="sr-only">{label}</span>
                {entry ? (
                  entry.events.map((e, i) => <span key={i} aria-hidden="true" className={cn("size-2.5 rounded-full", EVENT_DOT[e.type])} />)
                ) : (
                  <span aria-hidden="true" className="size-2.5 rounded-full border border-line bg-ivory" />
                )}
              </li>
            );
          })}
        </ol>
      )}
      {progress.recordedFromTurn > 0 && (
        <p className="mt-1 text-xs text-muted">The timeline starts at your {messageLabel(progress.recordedFromTurn)}.</p>
      )}
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd>
        <span className="font-semibold text-charcoal">{value}</span>
        {detail && <span> {detail}</span>}
      </dd>
    </div>
  );
}

/** "Pip heard 1 idea, Pip changed its mind" from a timeline entry. */
function summarize(entry: TimelineEntry): string {
  const counts = new Map<string, number>();
  for (const e of entry.events) counts.set(eventLabel(e), (counts.get(eventLabel(e)) ?? 0) + 1);
  return [...counts].map(([label, n]) => (n > 1 ? `${label} (${plural(n, "time")})` : label)).join(", ");
}
