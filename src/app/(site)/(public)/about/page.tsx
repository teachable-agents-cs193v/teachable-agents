import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { DoodleBookStack, DoodleLightbulb, DoodleSprout, DoodleTicks } from "@/components/illustrations/Doodles";
import type { LearnerMood } from "@/lib/types";

export const metadata: Metadata = { title: "About" };

const MOODS: Array<{ mood: LearnerMood; caption: string }> = [
  { mood: "curious", caption: "asks" },
  { mood: "confused", caption: "gets stuck" },
  { mood: "thinking", caption: "works it through" },
  { mood: "happy", caption: "gets it" },
];

const TEAM = [
  { name: "Arielle", area: "Frontend and UX design" },
  { name: "Chase", area: "The AI learner and deployment" },
  { name: "Betania", area: "Database and session storage" },
  { name: "Anahi", area: "Accounts and authentication" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-16 px-4 py-14 sm:px-6 lg:py-20">
      <header className="flex flex-col gap-5">
        <Eyebrow tone="band">About the project</Eyebrow>
        <h1 className="type-h1 text-forest">
          The best way to learn something is to teach it.
          <DoodleTicks className="ml-1 inline-block size-8 -translate-y-3 text-leaf" />
        </h1>
        <p className="type-lead max-w-2xl text-charcoal/85">
          Pip is a Stanford CS193V final project built around the <em>protégé effect</em>: people understand ideas
          more deeply when they prepare to teach them, and more deeply still when they actually teach someone who asks
          questions. Here, that someone is Pip, the student the app is named after.
        </p>
      </header>

      <section className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start" aria-labelledby="who-title">
        <div className="flex flex-col gap-4">
          <h2 id="who-title" className="type-h2 text-forest">
            Who it&rsquo;s for
          </h2>
          <p className="leading-relaxed text-charcoal/85">
            College students in introductory conceptual courses who want to find out whether they really understand a
            concept before an exam asks them to. Reading a chapter and nodding along in lecture feel like understanding.
            Explaining the idea to a curious student, and being asked &ldquo;but why?&rdquo;, tests it.
          </p>
          <p className="leading-relaxed text-charcoal/85">
            The lessons are concepts students commonly half-understand, starting with probability. The library is small on
            purpose so each lesson can be done well.
          </p>
        </div>
        <DoodleBookStack className="size-32 justify-self-center text-charcoal md:size-40" />
      </section>

      <section className="card-sage flex flex-col gap-6 p-7 sm:p-9" aria-labelledby="pip-title">
        <div className="flex flex-col gap-3">
          <h2 id="pip-title" className="type-h2 text-forest">
            Meet Pip
          </h2>
          <p className="max-w-2xl leading-relaxed text-charcoal/85">
            Pip is the student you teach. Pip starts each lesson with a few plausible misconceptions, asks follow-up
            questions, tries to say ideas back, and only ends up believing what you manage to explain. Pip never grades
            you: the reflection at the end asks you to judge your own explanation.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {MOODS.map(({ mood, caption }) => (
            <li key={mood} className="flex flex-col items-center gap-2 rounded-2xl bg-paper/70 p-4 text-center">
              <LearnerAvatar mood={mood} size={88} />
              <span className="font-mono text-xs text-muted">Pip {caption}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          In the current build Pip follows a written script for each lesson while the AI learner is being integrated, so
          Pip won&rsquo;t react to your exact wording yet. The app says which learner is running on every session.
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-2" aria-labelledby="honest-title">
        <div className="flex flex-col gap-4">
          <h2 id="honest-title" className="type-h2 text-forest">
            What we don&rsquo;t claim
          </h2>
          <p className="leading-relaxed text-charcoal/85">
            An enjoyable conversation is not evidence that learning happened. The app counts what occurred in a session
            (messages, time, misconceptions Pip raised) and asks for your own reflection. It does not compute mastery,
            accuracy, or learning gains, because it can&rsquo;t honestly do so yet.
          </p>
        </div>
        <div className="flex items-start gap-4 rounded-2xl border border-line bg-paper p-5">
          <DoodleLightbulb className="size-12 shrink-0 text-charcoal" />
          <p className="text-sm leading-relaxed text-muted">
            Your sessions, explanations, and reflections are saved to your account and visible only to you. We don&rsquo;t
            use real student names in testing, and nothing you write is used to train a model.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="team-title">
        <div className="flex items-center gap-3">
          <DoodleSprout className="size-9 text-charcoal" />
          <h2 id="team-title" className="type-h2 text-forest">
            The team
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {TEAM.map((member) => (
            <li key={member.name} className="card flex items-center justify-between gap-4 px-5 py-4">
              <span className="font-display text-lg font-semibold text-charcoal">{member.name}</span>
              <span className="text-right text-sm text-muted">{member.area}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Teachable Agents and the Protégé Effect · Stanford CS193V, Autumn 2026.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button href="/topics" size="lg">
          Browse the lessons
        </Button>
        <Button href="/" variant="outline" size="lg">
          Back home
        </Button>
      </div>
    </div>
  );
}
