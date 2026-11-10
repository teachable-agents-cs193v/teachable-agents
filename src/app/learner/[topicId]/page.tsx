import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MeetLearner } from "@/components/screens/MeetLearner";
import { TOPICS, getTopic } from "@/lib/topics";
import { requireUser } from "@/lib/auth/server";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topicId: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ topicId: string }> }): Promise<Metadata> {
  const { topicId } = await params;
  const topic = getTopic(topicId);
  return { title: topic ? `Meet Pip · ${topic.title}` : "Meet Pip" };
}

export default async function LearnerPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  await requireUser(`/learner/${topicId}`);
  const topic = getTopic(topicId);
  if (!topic) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <MeetLearner topic={topic} />
      </main>
      <Footer />
    </>
  );
}
