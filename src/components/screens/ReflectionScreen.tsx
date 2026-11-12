"use client";

import { useEffect, useState } from "react";
import type { SessionReflection, TeachingSession } from "@/lib/types";
import { getSessionStore } from "@/lib/persistence";
import { getTopic } from "@/lib/topics";
import { accentStyle, getSubject } from "@/lib/subjects";
import { formatDate, formatDuration, summarizeSession } from "@/lib/utils";
import { PIP } from "@/lib/learner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ReflectionForm } from "@/components/ReflectionForm";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { LoadErrorState } from "@/components/LoadErrorState";
import { ArrowRightIcon, CheckIcon, QuestionIcon, SparkleIcon, SUBJECT_ICONS } from "@/components/illustrations/Icons";

export function ReflectionScreen({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessionStore()
      .getSession(sessionId)
      .then((found) => {
        if (cancelled) return;
        setSession(found);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Please try again.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted" role="status">
        Loading your session…
      </div>
    );
  }

  if (loadError) return <LoadErrorState message={loadError} />;

  const topic = session ? getTopic(session.topicId) : undefined;
  if (!session || !topic) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
        <LearnerAvatar mood="confused" size={88} />
        <h1 className="font-display text-3xl text-forest">That session isn&rsquo;t here.</h1>
        <p className="text-muted">It may have been deleted, or it belongs to a different account. Start a new one from the library.</p>
        <Button href="/topics">Explore topics</Button>
      </div>
    );
  }

  if (session.status === "in_progress") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
        <LearnerAvatar mood="curious" size={88} />
        <h1 className="font-display text-3xl text-forest">This session is still going.</h1>
        <p className="text-muted">End it from the workspace when you are ready to reflect.</p>
        <Button href={`/teach/${session.id}`}>Back to the session</Button>
      </div>
    );
  }

  const subject = getSubject(topic.subjectId);
  const Icon = SUBJECT_ICONS[topic.subjectId];
  const summary = summarizeSession(session);

  const saveReflection = async (reflection: SessionReflection) => {
    const next = { ...session, reflection };
    setSaveError(null);
    try {
      await getSessionStore().saveSession(next);
    } catch (error) {
      // The form keeps the student's answers, so they can submit again.
      setSaveError(error instanceof Error ? error.message : "Your reflection couldn't be saved. Try again.");
      return;
    }
    setSession(next);
    setSaved(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={accentStyle(subject)} className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6">
      {/* Header */}
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="accent">
            <Icon className="size-3.5" /> {subject.label}
          </Badge>
          <Badge tone="sage">
            <CheckIcon className="size-3.5" /> Session completed
          </Badge>
          <span className="text-sm text-muted">{formatDate(session.startedAt)}</span>
        </div>
        <div className="flex items-start gap-5">
          <div className="hidden sm:block">
            <LearnerAvatar mood="happy" size={88} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl leading-tight text-forest sm:text-5xl">
              {saved ? "Reflection saved." : "You taught Pip."}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted">
              {saved
                ? "Thanks for thinking it through. Your answers are stored with this session."
                : `Here is what happened in your session on ${topic.title}. Then take a few minutes to reflect: this part is where the learning tends to show up.`}
            </p>
          </div>
        </div>
        {saved && (
          <div className="flex flex-wrap gap-3 animate-pop">
            <Button href={`/learner/${topic.id}`}>
              Teach Again <ArrowRightIcon className="size-4" />
            </Button>
            <Button href="/topics" variant="outline">Explore Topics</Button>
            <Button href={`/sessions/${session.id}`} variant="ghost">Review transcript</Button>
          </div>
        )}
      </header>

      {/* Observed activity */}
      <section className="grid gap-4 sm:grid-cols-3" aria-label="What happened in this session">
        <Stat label="Messages exchanged" value={String(summary.totalMessages)} detail={`${summary.studentMessages} from you, ${summary.learnerMessages} from ${PIP.name}`} />
        <Stat label="Time teaching" value={formatDuration(summary.durationMinutes)} detail="From first message to End Session" />
        <Stat label="Misconceptions raised" value={String(summary.misconceptions.length)} detail={`Mistakes ${PIP.name} voiced for you to correct`} />
      </section>
      <p className="-mt-6 text-xs text-muted">
        These are counts of what happened. They are not a score, and they do not measure what you learned.
      </p>

      {/* Scripted content */}
      <section className="grid gap-6 md:grid-cols-2" aria-label="What Pip brought up">
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-2xl text-charcoal">
              <SparkleIcon className="size-5 text-terracotta" /> Concepts discussed
            </h2>
            <Badge tone="neutral">From {PIP.name}&rsquo;s script</Badge>
          </div>
          {summary.concepts.length ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {summary.concepts.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-charcoal/90">
                  <CheckIcon className="mt-1 size-4 shrink-0 accent-text" /> {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Pip did not get far enough to raise a concept this time.</p>
          )}
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-2xl text-charcoal">
              <QuestionIcon className="size-5 text-terracotta" /> Misconceptions {PIP.name} introduced
            </h2>
            <Badge tone="neutral">From {PIP.name}&rsquo;s script</Badge>
          </div>
          {summary.misconceptions.length ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {summary.misconceptions.map((m) => (
                <li key={m} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-charcoal/90">
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-terracotta" aria-hidden="true" /> {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">No misconceptions came up before the session ended.</p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Whether each one was fully corrected is for you to judge in the reflection below. The app does not grade your explanations.
          </p>
        </div>
      </section>

      {session.preExplanation && (
        <section className="card paper-lines p-6 pl-14" aria-label="Your explanation before the session">
          <h2 className="font-display text-xl text-charcoal">What you wrote before teaching</h2>
          <p className="mt-2 leading-[1.9rem] text-charcoal/90">{session.preExplanation}</p>
          <p className="mt-2 text-xs text-muted">Compare this with your explanation below.</p>
        </section>
      )}

      {/* Self-reflection */}
      <section className="card p-6 sm:p-9" aria-labelledby="reflection-title">
        <div className="mb-8 flex flex-col gap-2">
          <Badge tone="butter" className="w-fit">Your self-assessment</Badge>
          <h2 id="reflection-title" className="font-display text-3xl text-forest">Reflect on your teaching</h2>
          <p className="max-w-2xl leading-relaxed text-muted">
            Honest answers are more useful than confident ones. Nobody is grading this; it exists to help you
            notice what you understand and what you do not.
          </p>
        </div>
        {saveError && (
          <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-charcoal">
            <span className="font-medium text-danger">Reflection not saved.</span> {saveError}
          </p>
        )}
        <ReflectionForm postSessionPrompt={topic.postSessionPrompt} initial={session.reflection} onSubmit={saveReflection} />
      </section>

      {!saved && (
        <div className="flex flex-wrap gap-3">
          <Button href={`/learner/${topic.id}`} variant="outline">Teach Again</Button>
          <Button href="/topics" variant="ghost">Explore Topics</Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card flex flex-col gap-1 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="font-display text-3xl text-forest">{value}</p>
      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}
