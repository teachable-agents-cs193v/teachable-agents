import type { Metadata } from "next";
import { TeachingWorkspace } from "@/components/screens/TeachingWorkspace";

export const metadata: Metadata = { title: "Teaching session" };

export default async function TeachPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <TeachingWorkspace sessionId={sessionId} />;
}
