"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeachingSession, Topic } from "@/lib/types";
import { PIP } from "@/lib/learner";
import { getSessionStore } from "@/lib/persistence";
import { startSession } from "@/lib/sessions";
import { accentStyle, getSubject } from "@/lib/subjects";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, inputClasses } from "@/components/ui/Field";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { TeachingTips } from "@/components/TeachingTips";
import { ArrowLeftIcon, ArrowRightIcon, SUBJECT_ICONS } from "@/components/illustrations/Icons";

export function MeetLearner({ topic }: { topic: Topic }) {
  const router = useRouter();
  const subject = getSubject(topic.subjectId);
  const Icon = SUBJECT_ICONS[topic.subjectId];
  const [preExplanation, setPreExplanation] = useState("");
  const [active, setActive] = useState<TeachingSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessionStore()
      .findActiveSession(topic.id)
      .then((found) => {
        if (!cancelled) setActive(found);
      })
      // Without it there's just no "resume" option; starting a new session still works.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [topic.id]);

  const begin = async () => {
    setStarting(true);
    setError(null);
    try {
      const session = await startSession(topic.id, preExplanation);
      router.push(`/teach/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the session.");
      setStarting(false);
    }
  };

  return (
    <div style={accentStyle(subject)} className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-16">
      {/* Learner introduction */}
      <section className="flex flex-col gap-6" aria-labelledby="meet-title">
        <Button href="/topics" variant="ghost" size="sm" className="-ml-3 w-fit">
          <ArrowLeftIcon className="size-4" /> Back to topics
        </Button>
        <div className="card relative overflow-hidden p-7 sm:p-9">
          <div className="absolute -right-10 -top-10 size-40 rounded-full accent-bg opacity-70" aria-hidden="true" />
          <div className="relative flex flex-col gap-6">
            <div className="flex items-center gap-5">
              <div className="grid size-24 place-items-center rounded-full bg-ivory shadow-soft">
                <LearnerAvatar size={80} animated />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Meet your learner</p>
                <h1 id="meet-title" className="font-display text-4xl text-forest">
                  {PIP.name}
                </h1>
                <p className="text-muted">{PIP.tagline}</p>
              </div>
            </div>
            <blockquote className="rounded-2xl rounded-tl-md border border-line bg-ivory p-5 text-[17px] leading-relaxed text-charcoal">
              &ldquo;{topic.learnerIntro}&rdquo;
              <footer className="mt-2 text-sm text-muted">— {PIP.name}</footer>
            </blockquote>
            <div className="rounded-2xl bg-forest p-5 text-ivory">
              <p className="font-display text-xl">You are the teacher here.</p>
              <p className="mt-1 text-sm leading-relaxed text-ivory/80">
                Pip will not look anything up. Everything it ends up understanding has to come from you:
                your examples, your corrections, your explanations.
              </p>
            </div>
          </div>
        </div>
        <TeachingTips tips={topic.teachingTips} />
      </section>

      {/* Topic + pre-session */}
      <section className="flex flex-col gap-6" aria-labelledby="topic-title">
        <div className="card flex flex-col gap-5 p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl accent-bg accent-text">
              <Icon className="size-5" />
            </span>
            <Badge tone="accent">{subject.label}</Badge>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Selected topic</p>
            <h2 id="topic-title" className="font-display text-3xl leading-snug text-charcoal">
              {topic.title}
            </h2>
          </div>
          <div className="rounded-xl bg-ivory p-4 leading-relaxed">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] accent-text">Learning objective</p>
            <p className="mt-1 text-charcoal/90">{topic.learningObjective}</p>
          </div>

          <Field
            id="pre-explanation"
            label="Before you start: a quick explanation"
            hint={`${topic.preSessionPrompt} This is saved with your session so you can compare it with your thinking afterwards.`}
            optional
          >
            <textarea
              id="pre-explanation"
              rows={4}
              aria-describedby="pre-explanation-hint"
              value={preExplanation}
              onChange={(e) => setPreExplanation(e.target.value)}
              className={inputClasses}
              placeholder="Your current understanding, in your own words…"
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <Button size="lg" onClick={begin} disabled={starting}>
              {starting ? "Setting up…" : active ? "Start a new session" : "Start Teaching"}
              <ArrowRightIcon className="size-5" />
            </Button>
            {active && (
              <Button href={`/teach/${active.id}`} variant="outline" size="lg">
                Resume session from {formatDate(active.startedAt)}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
