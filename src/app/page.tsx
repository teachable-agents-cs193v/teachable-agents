import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ConversationPreview } from "@/components/ConversationPreview";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { RecentSessionsStrip } from "@/components/screens/RecentSessionsStrip";
import { PIP } from "@/lib/learner";
import { BookIcon, PencilIcon, SparkleIcon, ArrowRightIcon, QuestionIcon, LeafIcon, StarIcon } from "@/components/illustrations/Icons";

const steps = [
  {
    icon: BookIcon,
    title: "Choose a topic",
    text: "Pick something from the library you are supposed to understand, like independence in probability or how recursion unwinds.",
  },
  {
    icon: PencilIcon,
    title: "Teach your learner",
    text: "Pip asks questions and gets things wrong in believable ways. You explain, give examples, and correct the mistakes.",
  },
  {
    icon: SparkleIcon,
    title: "Reflect and grow",
    text: "Look back at what came up, explain the key idea without notes, and note where your own understanding felt shaky.",
  },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="dot-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
            <div className="flex flex-col gap-7 animate-fade-up">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm font-medium text-forest shadow-soft">
                <LeafIcon className="size-4 text-terracotta" />
                Built on the protégé effect
              </span>
              <h1 className="font-display text-5xl leading-[1.05] text-forest sm:text-6xl lg:text-7xl">
                The best way to learn is to teach.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
                Protégé flips the usual AI tutor around. You are the teacher. Pip, a curious AI learner,
                asks questions, makes plausible mistakes, and needs you to explain things clearly. Deepen
                your own understanding by teaching.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button href="/topics" size="lg">
                  Start Teaching
                  <ArrowRightIcon className="size-5" />
                </Button>
                <Button href="#how-it-works" variant="outline" size="lg">
                  How It Works
                </Button>
              </div>
              <p className="text-sm text-muted">
                Make an account to start. Your sessions are saved to it.
              </p>
            </div>
            <ConversationPreview className="animate-pop lg:rotate-[0.5deg]" />
          </div>
        </section>

        {/* Not a chatbot */}
        <section className="border-y border-line/70 bg-sage/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
            {[
              ["You explain.", "Instead of receiving answers, you produce them. Putting an idea into words is where understanding gets tested."],
              ["Pip gets it wrong.", "The learner introduces believable misconceptions. Catching and correcting them is the work."],
              ["You notice the gaps.", "If an explanation falls apart mid-sentence, that is useful information about what to study next."],
            ].map(([title, text]) => (
              <div key={title} className="flex flex-col gap-2">
                <h2 className="font-display text-2xl text-forest">{title}</h2>
                <p className="leading-relaxed text-charcoal/80">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="How it works"
              title="Three steps, one curious learner"
              description="Each session takes ten to fifteen minutes and ends with a short reflection designed to help you see what you actually understand."
              align="center"
              className="mx-auto"
            />
            <ol className="grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="card relative flex flex-col gap-4 p-7">
                  <span className="absolute right-5 top-5 font-display text-5xl text-sage-deep" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="grid size-12 place-items-center rounded-2xl bg-butter text-forest">
                    <step.icon className="size-6" />
                  </span>
                  <h3 className="font-display text-2xl text-charcoal">{step.title}</h3>
                  <p className="leading-relaxed text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Meet Pip */}
        <section id="meet-pip" className="scroll-mt-20 bg-paper">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="relative mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-sage/70 blur-2xl" aria-hidden="true" />
              <div className="relative grid size-56 place-items-center rounded-full border border-line bg-ivory shadow-soft sm:size-64">
                <LearnerAvatar size={170} animated />
              </div>
              <StarIcon className="absolute -right-2 top-6 size-7 text-butter-deep" />
              <QuestionIcon className="absolute -left-3 bottom-10 size-8 text-terracotta" />
            </div>
            <div className="flex flex-col gap-6">
              <SectionHeading
                eyebrow="Meet your learner"
                title={`This is ${PIP.name}.`}
                description={`${PIP.name} is enthusiastic, a little confused, and determined to understand. ${PIP.tagline}`}
              />
              <ul className="flex flex-col gap-3">
                {PIP.personality.map((trait) => (
                  <li key={trait} className="flex items-start gap-3 text-[17px] text-charcoal/85">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-terracotta" aria-hidden="true" />
                    {trait}
                  </li>
                ))}
              </ul>
              <p className="rounded-2xl border border-butter-deep/60 bg-butter/50 p-4 text-[15px] leading-relaxed text-charcoal/85">
                <strong className="font-semibold">Demo note.</strong> In this prototype Pip follows a written script for
                each topic. It will not understand your exact wording, but every question and mistake it raises is
                real material to teach against.
              </p>
              <div>
                <Button href="/topics">Choose a topic to teach</Button>
              </div>
            </div>
          </div>
        </section>

        <RecentSessionsStrip />

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
          <div className="card paper-lines flex flex-col items-start gap-5 p-8 pl-16 sm:p-12 sm:pl-20">
            <h2 className="font-display text-3xl text-forest sm:text-4xl">Ready to find out what you really know?</h2>
            <p className="max-w-xl text-lg text-muted">Pick a topic, teach it to Pip, and see which parts you can explain without looking anything up.</p>
            <Button href="/topics" size="lg">
              Start Teaching
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
