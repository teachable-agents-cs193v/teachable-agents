import Link from "next/link";
import { CARD, DETAILS_HREF, PROVIDER } from "@/lib/aiData";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/illustrations/Icons";

/**
 * "Where your words go": shown, open, every time a student starts a session, right above the one
 * way to start. It informs; there's nothing to choose. All wording comes from src/lib/aiData.ts.
 */
export function AiNoticeCard({
  onStart,
  starting,
  label = CARD.startButton,
}: {
  onStart: () => void;
  /** True while the session is being created. */
  starting: boolean;
  label?: string;
}) {
  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border border-line bg-ivory p-5"
      aria-labelledby="ai-notice-title"
      data-testid="ai-notice"
    >
      <div className="flex flex-col gap-1">
        <h3 id="ai-notice-title" className="font-display text-xl text-charcoal">
          {CARD.title}
        </h3>
        <p className="text-sm leading-relaxed text-charcoal/85">
          {CARD.summary}{" "}
          <Link href={DETAILS_HREF} className="focus-ring rounded font-medium text-forest underline underline-offset-2">
            Full details
          </Link>
        </p>
      </div>

      <details open className="group text-sm leading-relaxed text-charcoal/90">
        <summary className="focus-ring w-fit cursor-pointer rounded font-medium text-forest hover:underline">
          What&rsquo;s sent, and what isn&rsquo;t
        </summary>
        <dl className="mt-3 grid gap-3">
          <Item term={`Sent to ${PROVIDER}`}>{CARD.sent}</Item>
          <Item term="Not sent">{CARD.notSent}</Item>
          <Item term={`What ${PROVIDER} does with it`}>{CARD.provider}</Item>
          <Item term="What we keep">{CARD.stored}</Item>
        </dl>
      </details>

      <div>
        <Button size="lg" className="h-auto min-h-11 py-2 text-center" onClick={onStart} disabled={starting}>
          {starting ? "Setting up…" : label}
          {!starting && <ArrowRightIcon className="size-5 shrink-0" />}
        </Button>
      </div>
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
