import type { Metadata } from "next";
import { ReflectionScreen } from "@/components/screens/ReflectionScreen";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Reflect" };

export default async function ReflectPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  await requireUser(`/reflect/${encodeURIComponent(sessionId)}`);
  return <ReflectionScreen sessionId={sessionId} />;
}
