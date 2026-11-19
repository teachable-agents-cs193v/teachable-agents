import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetLearner } from "@/components/screens/MeetLearner";
import { getStartableTopic, getTopic, visibleTopics } from "@/lib/topics";
import { requireUser } from "@/lib/auth/server";

export function generateStaticParams() {
  return visibleTopics().map((t) => ({ topicId: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ topicId: string }> }): Promise<Metadata> {
  const { topicId } = await params;
  const topic = getTopic(topicId);
  return { title: topic ? `Meet Pip · ${topic.title}` : "Meet Pip" };
}

export default async function LearnerPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  await requireUser(`/learner/${encodeURIComponent(topicId)}`);
  // Hidden topics can't start new sessions; their existing sessions open from /sessions.
  const topic = getStartableTopic(topicId);
  if (!topic) notFound();

  return <MeetLearner topic={topic} />;
}
