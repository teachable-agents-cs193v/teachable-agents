import { Badge } from "@/components/ui/Badge";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { DoodleArrowLoop, DoodlePencil } from "@/components/illustrations/Doodles";
import type { LearnerMood } from "@/lib/types";

/**
 * An illustrative exchange for the landing page. We wrote it to show the shape
 * of a session (a misconception, an explanation, a belief that changes); it is
 * not a recording of a real student and is labelled as an example on screen.
 */
const PIP_MISCONCEPTION =
  "Wait, I'm a little confused. If two events are independent, doesn't that mean they can't happen at the same time?";
const STUDENT_EXPLANATION =
  "Not quite. Independence means one event happening doesn't change the probability of the other. Flip a coin and roll a die: heads doesn't make a six any more or less likely, but they can both happen on the same turn.";
const PIP_REPLY =
  "Oh! So independent events can happen together. And mutually exclusive ones can't, which actually makes them dependent?";

function PipTurn({ mood, label, children }: { mood: LearnerMood; label: string; children: string }) {
  return (
    <div className="flex items-start gap-3">
      <LearnerAvatar mood={mood} size={44} />
      <div className="flex max-w-[85%] flex-col gap-1.5">
        <span className="type-label text-muted">{label}</span>
        <p className="rounded-2xl rounded-tl-md border border-line bg-paper px-4 py-3 leading-relaxed text-charcoal">{children}</p>
      </div>
    </div>
  );
}

function StudentTurn({ children }: { children: string }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="flex max-w-[85%] flex-col items-end gap-1.5">
        <span className="type-label text-leaf">You, the teacher</span>
        <p className="paper-lines rounded-2xl rounded-tr-md border border-sage-deep py-3 pl-14 pr-4 leading-[1.9rem] text-charcoal">{children}</p>
      </div>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-butter" aria-hidden="true">
        <DoodlePencil className="size-6 text-charcoal" />
      </span>
    </div>
  );
}

export function ExampleConversation() {
  return (
    <section aria-labelledby="example-title">
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          eyebrow="An example"
          title={<span id="example-title">What teaching Pip looks like.</span>}
          description="A short exchange from a probability lesson, written to show the shape of a session. It isn't a recording of a real student."
        />

        <div className="card relative flex flex-col gap-6 p-5 sm:p-7" aria-label="Example teaching exchange">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex flex-col">
              <span className="type-label text-muted">Lesson</span>
              <span className="font-display text-lg font-semibold text-forest">Independence vs. mutual exclusivity</span>
            </div>
            <Badge tone="butter" mono>
              Example
            </Badge>
          </div>

          <PipTurn mood="confused" label="Pip has a misconception">
            {PIP_MISCONCEPTION}
          </PipTurn>
          <StudentTurn>{STUDENT_EXPLANATION}</StudentTurn>
          <PipTurn mood="happy" label="Pip tries it back">
            {PIP_REPLY}
          </PipTurn>

          <div className="card-sage relative mt-2 flex flex-col gap-3 p-5">
            <DoodleArrowLoop className="absolute -top-4 right-5 size-10 text-leaf" aria-hidden="true" />
            <Eyebrow tone="muted">A possible belief update</Eyebrow>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="type-label text-muted">Pip believed</dt>
                <dd className="text-charcoal/70 line-through decoration-leaf decoration-2">
                  Independent events can&rsquo;t happen at the same time.
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="type-label text-leaf">Pip now believes</dt>
                <dd className="font-medium text-charcoal">
                  Independent events can happen together. Independence is about one not changing the other&rsquo;s probability.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
