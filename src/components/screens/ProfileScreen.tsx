import { AuthNavControl } from "@/components/auth/AuthNavControl";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DoodleSprout } from "@/components/illustrations/Doodles";
import { TOPICS } from "@/lib/topics";
import type { AuthUser, TeachingSession } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * The student's account page: who they are logged in as, what they have
 * taught (counts only), and a way to log out. Editing the account is not
 * built yet and the page says so rather than pretending.
 */
export function ProfileScreen({ user, sessions }: { user: AuthUser; sessions: TeachingSession[] }) {
  const completed = sessions.filter((s) => s.status === "completed");
  const active = sessions.filter((s) => s.status === "in_progress");
  const lessonsTaught = new Set(completed.map((s) => s.topicId)).size;
  const first = sessions.length ? sessions.reduce((a, b) => (a.startedAt < b.startedAt ? a : b)) : null;

  return (
    <>
      <section className="border-b border-sage bg-mint">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-14 sm:px-6">
          <Eyebrow>Profile</Eyebrow>
          <h1 className="type-h1 text-forest">{user.name}</h1>
          <p className="type-lead text-muted">Your account, and a record of what you have taught Pip.</p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-2">
        <section className="card flex flex-col gap-5 p-6" aria-labelledby="account-title">
          <h2 id="account-title" className="type-h3 text-forest">
            Account
          </h2>
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <dt className="type-label text-muted">Name</dt>
              <dd className="text-charcoal">{user.name}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="type-label text-muted">Email</dt>
              <dd className="break-words text-charcoal">{user.email}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted">Changing your name or password isn&rsquo;t available yet.</p>
          <div className="border-t border-line pt-5">
            <AuthNavControl layout="menu" />
          </div>
        </section>

        <section className="card-sage flex flex-col gap-5 p-6" aria-labelledby="teaching-title">
          <div className="flex items-center gap-3">
            <DoodleSprout className="size-8 text-charcoal" />
            <h2 id="teaching-title" className="type-h3 text-forest">
              Your teaching
            </h2>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3">
            <dt className="text-charcoal/85">Sessions completed</dt>
            <dd className="font-display text-lg font-semibold text-forest tabular-nums">{completed.length}</dd>
            <dt className="text-charcoal/85">In progress</dt>
            <dd className="font-display text-lg font-semibold text-forest tabular-nums">{active.length}</dd>
            <dt className="text-charcoal/85">Lessons taught</dt>
            <dd className="font-display text-lg font-semibold text-forest tabular-nums">
              {lessonsTaught} of {TOPICS.length}
            </dd>
            <dt className="text-charcoal/85">First session</dt>
            <dd className="font-display text-lg font-semibold text-forest">{first ? formatDate(first.startedAt) : "Not yet"}</dd>
          </dl>
          <p className="text-sm text-muted">
            These are counts of what happened, not a measure of what you learned. The reflection at the end of each
            session is where that judgement lives, and it is yours.
          </p>
          <div className="mt-auto flex flex-wrap gap-3 pt-2">
            <Button href={sessions.length ? "/sessions" : "/dashboard#lessons"}>
              {sessions.length ? "See my sessions" : "Pick a first lesson"}
            </Button>
          </div>
        </section>

        <div className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-5 md:col-span-2">
          <LearnerAvatar mood="happy" size={56} />
          <p className="text-sm leading-relaxed text-muted">
            Your sessions, explanations and reflections are saved to this account and visible only to you.
          </p>
        </div>
      </div>
    </>
  );
}
