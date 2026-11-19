import Link from "next/link";
import { aiAllowed, DETAILS_HREF, SESSION_LINE } from "@/lib/aiData";
import { cn } from "@/lib/utils";

/**
 * The always-visible line on the teach screen saying where the student's messages go.
 * `answeredBy` is the learner that last replied: "scripted-demo" when no model is answering
 * (the server has none configured), and then nothing is sent. A session whose learnerId
 * doesn't allow AI never uses a model either.
 */
export function DataLine({ learnerId, answeredBy, className }: { learnerId: string; answeredBy: string | null; className?: string }) {
  const ai = aiAllowed(learnerId) && answeredBy !== "scripted-demo";
  return (
    <p className={cn("text-xs leading-relaxed text-muted", className)} data-testid="data-line" data-mode={ai ? "ai" : "scripted"}>
      {ai ? SESSION_LINE.ai : SESSION_LINE.aiUnavailable}{" "}
      <Link href={DETAILS_HREF} className="focus-ring rounded font-medium text-forest underline underline-offset-2">
        Details
      </Link>
    </p>
  );
}
