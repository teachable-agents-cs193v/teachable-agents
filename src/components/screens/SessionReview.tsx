"use client";

import { useEffect, useState } from "react";
import type { TeachingSession } from "@/lib/types";
import { getSessionStore } from "@/lib/persistence";
import { getTopic } from "@/lib/topics";
import { accentStyle, getSubject } from "@/lib/subjects";
import { formatDate, formatDuration, summarizeSession } from "@/lib/utils";
import { PIP } from "@/lib/learner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ChatMessage } from "@/components/ChatMessage";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { ArrowLeftIcon, SUBJECT_ICONS } from "@/components/illustrations/Icons";

const CONFIDENCE_LABELS = ["", "Not confident", "A little", "Somewhat", "Fairly", "Very confident"];

export function SessionReview({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSessionStore()
      .getSession(sessionId)
      .then((found) => {
        if (cancelled) return;
        setSession(found);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) return <p className="py-24 text-center text-muted" role="status">Loading session…</p>;

  const topic = session ? getTopic(session.topicId) : undefined;
  if (!session || !topic) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
        <LearnerAvatar mood="confused" size={88} />
        <h1 className="font-display text-3xl text-forest">That session isn&rsquo;t here.</h1>
        <Button href="/sessions">Back to sessions</Button>
      </div>
    );
  }

  const subject = getSubject(topic.subjectId);
  const Icon = SUBJECT_ICONS[topic.subjectId];
  const summary = summarizeSession(session);
  const r = session.reflection;

  return (
    <div style={accentStyle(subject)} className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Button href="/sessions" variant="ghost" size="sm" className="-ml-3 w-fit">
        <ArrowLeftIcon className="size-4" /> All sessions
      </Button>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent"><Icon className="size-3.5" /> {subject.label}</Badge>
          {session.status === "completed" ? <Badge tone="sage">Completed</Badge> : <Badge tone="butter">In progress</Badge>}
        </div>
        <h1 className="font-display text-4xl text-forest">{topic.title}</h1>
        <p className="text-muted">
          {formatDate(session.startedAt)} · {summary.totalMessages} messages · {formatDuration(summary.durationMinutes)}
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          {session.status === "in_progress" ? (
            <Button href={`/teach/${session.id}`}>Resume session</Button>
          ) : (
            <Button href={`/reflect/${session.id}`} variant="outline">{r ? "Edit reflection" : "Add reflection"}</Button>
          )}
          <Button href={`/learner/${topic.id}`} variant="ghost">Teach again</Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="transcript-title">
          <h2 id="transcript-title" className="font-display text-2xl text-charcoal">Transcript</h2>
          {session.preExplanation && (
            <div className="mt-4 rounded-2xl bg-butter/50 px-4 py-3 text-sm leading-relaxed text-charcoal/85">
              <span className="font-semibold">Before starting, you wrote: </span>
              {session.preExplanation}
            </div>
          )}
          <ol className="mt-5 flex flex-col gap-5">
            {session.messages.map((m) => (
              <li key={m.id}>
                <ChatMessage message={m} learnerName={PIP.name} showTurnLabels animate={false} />
              </li>
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-4" aria-labelledby="reflection-review-title">
          <div className="card p-5 sm:p-6">
            <h2 id="reflection-review-title" className="font-display text-2xl text-charcoal">Your reflection</h2>
            {!r ? (
              <p className="mt-3 text-sm text-muted">You have not reflected on this session yet.</p>
            ) : (
              <dl className="mt-4 flex flex-col gap-5 text-[15px]">
                <ReviewItem label="Key concept, explained without notes">{r.postExplanation}</ReviewItem>
                <ReviewItem label="Confidence">{r.confidence}/5 · {CONFIDENCE_LABELS[r.confidence]}</ReviewItem>
                <ReviewItem label="Hardest to explain">{r.hardestToExplain}</ReviewItem>
                {r.misconceptionReflection && <ReviewItem label="On Pip's misconceptions">{r.misconceptionReflection}</ReviewItem>}
                <ReviewItem label="Noticed a gap in understanding?">
                  {r.noticedGap === "yes" ? "Yes" : r.noticedGap === "no" ? "No" : "Not sure"}
                  {r.noticedGapDetail && <span className="block text-muted">{r.noticedGapDetail}</span>}
                </ReviewItem>
                {r.freeReflection && <ReviewItem label="Other notes">{r.freeReflection}</ReviewItem>}
              </dl>
            )}
          </div>
          <div className="card p-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Misconceptions raised by {PIP.name}</p>
            {summary.misconceptions.length ? (
              <ul className="mt-2 flex flex-col gap-1.5 text-charcoal/90">
                {summary.misconceptions.map((m) => <li key={m}>· {m}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-muted">None came up.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-charcoal/90">{children}</dd>
    </div>
  );
}
