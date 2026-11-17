import Link from "next/link";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { SessionCard } from "@/components/SessionCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DoodleBookOpen, DoodleStar, DoodleTicks, SUBJECT_DOODLES } from "@/components/illustrations/Doodles";
import { ArrowRightIcon } from "@/components/illustrations/Icons";
import { firstName } from "@/lib/auth/displayName";
import { accentStyle, getSubject } from "@/lib/subjects";
import { TOPICS, getTopic } from "@/lib/topics";
import type { AuthUser, TeachingSession, Topic } from "@/lib/types";
import { formatDate, summarizeSession } from "@/lib/utils";

interface DashboardScreenProps {
  user: AuthUser;
  /** Every session this user owns, newest first, straight from the server store. */
  sessions: TeachingSession[];
}

/** The student's home: what to continue, what to teach next, and what they have done. */
export function DashboardScreen({ user, sessions }: DashboardScreenProps) {
  const name = firstName(user.name, user.email);
  const active = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "completed");
  const firstTime = sessions.length === 0;

  return (
    <>
      <WelcomeBand name={name} firstTime={firstTime} active={active.length} completed={completed} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-12 sm:px-6">
        {firstTime ? <FirstSession /> : active.length > 0 && <ContinueLearning sessions={active} />}
        <LessonPicker sessions={sessions} />
        {!firstTime && <RecentSessions sessions={completed} />}
      </div>
    </>
  );
}

function WelcomeBand({ name, firstTime, active, completed }: { name: string; firstTime: boolean; active: number; completed: TeachingSession[] }) {
  const lessonsTaught = new Set(completed.map((s) => s.topicId)).size;
  return (
    <section className="border-b border-sage bg-mint" aria-labelledby="welcome-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="flex flex-col gap-5">
          <Eyebrow tone="band">Home</Eyebrow>
          <h1 id="welcome-title" className="type-h1 text-forest">
            {firstTime ? `Welcome, ${name}!` : `Welcome back, ${name}!`}
            <DoodleTicks className="ml-1 inline-block size-8 -translate-y-3 text-leaf" />
          </h1>
          <p className="type-lead max-w-xl text-muted">
            {firstTime
              ? "Pip is ready for a first lesson. Pick one below; a session takes ten to fifteen minutes."
              : "Ready to teach something new?"}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button href="/topics" size="lg">
              New teaching session
              <ArrowRightIcon className="size-5" />
            </Button>
            {!firstTime && (
              <Button href="/sessions" variant="outline" size="lg">
                My sessions
              </Button>
            )}
          </div>
        </div>

        {firstTime ? (
          <div className="relative w-fit justify-self-start rotate-2 rounded-2xl bg-butter px-6 py-5 shadow-soft lg:justify-self-center" aria-hidden="true">
            <DoodleStar className="absolute -left-4 -top-4 size-9 text-charcoal" />
            <p className="font-display text-lg font-semibold leading-snug text-charcoal">
              Nothing taught yet.
              <br />
              Pip is waiting.
            </p>
          </div>
        ) : (
          <dl className="paper-lines grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 rounded-2xl border border-sage-deep py-3 pl-14 pr-5 shadow-soft lg:justify-self-center">
            <Stat label="Sessions completed" value={completed.length} />
            <Stat label="In progress" value={active} />
            <Stat label="Lessons taught" value={`${lessonsTaught} of ${TOPICS.length}`} />
          </dl>
        )}
      </div>
    </section>
  );
}

/** One row of the stats card. Counts only; nothing here claims learning happened. */
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <>
      <dt className="font-mono text-xs uppercase leading-[1.9rem] tracking-[0.12em] text-muted">{label}</dt>
      <dd className="font-display text-lg font-semibold leading-[1.9rem] text-forest tabular-nums">{value}</dd>
    </>
  );
}

const STEPS = [
  ["Pick a lesson", "Something you half-know works best."],
  ["Teach Pip", "Explain it in your own words and catch Pip's mistakes."],
  ["Reflect", "Say what was hard to explain. No grades, just a mirror."],
] as const;

/** For a student with no sessions yet: what a session is, and one clear way to start. */
function FirstSession() {
  return (
    <section className="card-sage relative grid gap-8 overflow-hidden p-7 sm:p-9 lg:grid-cols-[auto_1fr] lg:items-center" aria-labelledby="first-title">
      <LearnerAvatar mood="curious" size={120} animated className="justify-self-center" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="first-title" className="type-h2 text-forest">
            Your first session
          </h2>
          <p className="max-w-xl text-charcoal/85">
            Pip starts every lesson with a few plausible misconceptions and only ends up believing what you manage to
            explain. Here is the whole shape of it.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-1.5 rounded-2xl bg-paper/80 p-4">
              <span className="band w-fit font-mono text-xs font-medium text-forest">0{i + 1}</span>
              <span className="font-display text-lg font-semibold text-forest">{title}</span>
              <span className="text-sm text-muted">{text}</span>
            </li>
          ))}
        </ol>
        <div>
          <Button href="#lessons" size="lg">
            Pick your first lesson
            <ArrowRightIcon className="size-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Unfinished sessions, newest first, each one tap away from the workspace. */
function ContinueLearning({ sessions }: { sessions: TeachingSession[] }) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="continue-title">
      <SectionHeading eyebrow="Continue learning" title={<span id="continue-title">Pick up where you left off.</span>} />
      <ul className="grid gap-4 md:grid-cols-2">
        {sessions.slice(0, 4).map((session) => {
          const topic = getTopic(session.topicId);
          const summary = summarizeSession(session);
          return (
            <li key={session.id}>
              <Link
                href={`/teach/${session.id}`}
                className="card-sage focus-ring group flex items-center gap-5 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <DoodleBookOpen className="size-14 shrink-0 text-charcoal" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="type-label text-muted">Continue your lesson</span>
                  <span className="font-display text-xl font-semibold text-forest">{topic?.title ?? session.topicId}</span>
                  <span className="text-sm text-muted">
                    Started {formatDate(session.startedAt)} · {summary.totalMessages} messages
                  </span>
                </span>
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest text-ivory transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                  <ArrowRightIcon className="size-5" />
                </span>
                <span className="sr-only">Resume</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Every lesson in the library, with what this student has done with each. */
function LessonPicker({ sessions }: { sessions: TeachingSession[] }) {
  return (
    <section id="lessons" className="flex flex-col gap-6 scroll-mt-24" aria-labelledby="lessons-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Lessons"
          title={<span id="lessons-title">Pick a lesson to teach.</span>}
          description="Concepts students commonly half-understand. Each one starts a new session with Pip."
        />
        <Button href="/topics" variant="outline" size="sm">
          Browse the library
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic) => (
          <li key={topic.id}>
            <LessonCard
              topic={topic}
              taught={sessions.filter((s) => s.status === "completed" && s.topicId === topic.id).length}
              inProgress={sessions.some((s) => s.status === "in_progress" && s.topicId === topic.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonCard({ topic, taught, inProgress }: { topic: Topic; taught: number; inProgress: boolean }) {
  const subject = getSubject(topic.subjectId);
  const Doodle = SUBJECT_DOODLES[topic.subjectId];
  return (
    <article style={accentStyle(subject)} className="card group flex h-full flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-2xl accent-bg text-charcoal">
          <Doodle className="size-9" />
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {inProgress && <Badge tone="butter">In progress</Badge>}
          {taught > 0 && <Badge tone="sage">Taught {taught === 1 ? "once" : `${taught}×`}</Badge>}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="type-label accent-text">{subject.label}</span>
        <h3 className="font-display text-xl font-semibold leading-snug text-charcoal">{topic.title}</h3>
        <p className="text-sm leading-relaxed text-muted">{topic.description}</p>
      </div>
      <Link
        href={`/learner/${topic.id}`}
        className="focus-ring mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-forest-deep"
      >
        {inProgress ? "Continue or restart" : "Teach this"}
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

/** The last few completed sessions, from the same data as the My sessions page. */
function RecentSessions({ sessions }: { sessions: TeachingSession[] }) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="recent-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="Recent sessions" title={<span id="recent-title">What you have taught so far.</span>} />
        <Button href="/sessions" variant="outline" size="sm">
          See all sessions
        </Button>
      </div>
      {sessions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sage-deep px-5 py-6 text-muted">
          No completed sessions yet. Finish the one above and it will show up here with your reflection.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.slice(0, 3).map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </section>
  );
}
