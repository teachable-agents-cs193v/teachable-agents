import type { Metadata } from "next";
import { SessionReview } from "@/components/screens/SessionReview";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Session review" };

export default async function SessionReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  await requireUser(`/sessions/${encodeURIComponent(sessionId)}`);
  return <SessionReview sessionId={sessionId} />;
}
