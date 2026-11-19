import Link from "next/link";
import { DETAILS_HREF, modeOf, SESSION_LINE } from "@/lib/aiData";
import { cn } from "@/lib/utils";

/**
 * The always-visible line on the teach screen saying where the student's messages go.
 * `learnerId` is the session's stored choice; `answeredBy` is the learner that last replied
 * ("scripted-demo" for an AI session on a server with no model configured: then nothing is sent).
 */
export function DataLine({ learnerId, answeredBy, className }: { learnerId: string; answeredBy: string | null; className?: string }) {
  const mode = modeOf(learnerId);
  const line = mode === "offline" ? SESSION_LINE.offline : answeredBy === "scripted-demo" ? SESSION_LINE.aiUnavailable : SESSION_LINE.ai;
  return (
    <p className={cn("text-xs leading-relaxed text-muted", className)} data-testid="data-line" data-mode={mode}>
      {line}{" "}
      <Link href={DETAILS_HREF} className="focus-ring rounded font-medium text-forest underline underline-offset-2">
        Details
      </Link>
    </p>
  );
}
