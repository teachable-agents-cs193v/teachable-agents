"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CARD, CARD_SUMMARY, DETAILS_HREF, LAST_CHOICE_KEY, PROVIDER, type LearnerMode } from "@/lib/aiData";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/illustrations/Icons";

/** This browser's last choice, or null (never chosen, or storage is blocked). Only a default. */
function readLastChoice(): LearnerMode | null {
  try {
    const value = window.localStorage.getItem(LAST_CHOICE_KEY);
    return value === "ai" || value === "offline" ? value : null;
  } catch {
    return null;
  }
}

export function rememberChoice(mode: LearnerMode) {
  try {
    window.localStorage.setItem(LAST_CHOICE_KEY, mode);
  } catch {
    // Private window or blocked storage: the card just has no default next time.
  }
}

const noSubscribe = () => () => {};

/**
 * "Where your words go": shown every time a student starts a session, with the choice between
 * AI Pip and the offline demo Pip. The first time it's open in full; after that it's one line
 * (the student's last choice is the highlighted button) with the details a click away.
 * All wording comes from src/lib/aiData.ts.
 */
export function AiChoiceCard({
  onChoose,
  starting,
}: {
  onChoose: (mode: LearnerMode) => void;
  /** The choice being started, while the session is created. */
  starting: LearnerMode | null;
}) {
  // undefined during server rendering and hydration: show the full card until we know.
  const last = useSyncExternalStore(noSubscribe, readLastChoice, () => undefined);
  const seenBefore = last === "ai" || last === "offline";
  const preferred: LearnerMode = last === "offline" ? "offline" : "ai";

  const choose = (mode: LearnerMode) => {
    rememberChoice(mode);
    onChoose(mode);
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border border-line bg-ivory p-5"
      aria-labelledby="ai-choice-title"
      data-testid="ai-choice"
    >
      <div className="flex flex-col gap-1">
        <h3 id="ai-choice-title" className="font-display text-xl text-charcoal">
          {CARD.title}
        </h3>
        {seenBefore && <p className="text-sm leading-relaxed text-charcoal/85">{CARD_SUMMARY[preferred]}</p>}
      </div>

      <details open={!seenBefore} className="group text-sm leading-relaxed text-charcoal/90">
        <summary className="focus-ring w-fit cursor-pointer rounded font-medium text-forest hover:underline">
          {seenBefore ? "What's sent, and what isn't" : `If you teach AI Pip`}
        </summary>
        <dl className="mt-3 grid gap-3">
          <Item term={`Sent to ${PROVIDER}`}>{CARD.sent}</Item>
          <Item term="Not sent">{CARD.notSent}</Item>
          <Item term={`What ${PROVIDER} does with it`}>{CARD.provider}</Item>
          <Item term="What we keep">{CARD.stored}</Item>
        </dl>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          size="md"
          variant={preferred === "ai" ? "primary" : "outline"}
          className="h-auto min-h-11 py-2 text-center"
          onClick={() => choose("ai")}
          disabled={starting !== null}
        >
          {starting === "ai" ? "Setting up…" : CARD.aiButton}
          {starting !== "ai" && <ArrowRightIcon className="size-4 shrink-0" />}
        </Button>
        <Button
          size="md"
          variant={preferred === "offline" ? "primary" : "outline"}
          className="h-auto min-h-11 py-2 text-center"
          onClick={() => choose("offline")}
          disabled={starting !== null}
        >
          {starting === "offline" ? "Setting up…" : CARD.offlineButton}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        {CARD.offline}{" "}
        <Link href={DETAILS_HREF} className="focus-ring rounded font-medium text-forest underline underline-offset-2">
          Full details
        </Link>
      </p>
    </section>
  );
}

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{term}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
