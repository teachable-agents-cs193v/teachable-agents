import type { Metadata } from "next";
import { TeachingWorkspace } from "@/components/screens/TeachingWorkspace";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Teaching session" };

export default async function TeachPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  await requireUser(`/teach/${encodeURIComponent(sessionId)}`);
  return <TeachingWorkspace sessionId={sessionId} />;
}
