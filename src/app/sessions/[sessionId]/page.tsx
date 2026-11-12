import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SessionReview } from "@/components/screens/SessionReview";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Session review" };

export default async function SessionReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  await requireUser(`/sessions/${encodeURIComponent(sessionId)}`);
  return (
    <>
      <Navbar />
      <main className="flex flex-1 flex-col">
        <SessionReview sessionId={sessionId} />
      </main>
      <Footer />
    </>
  );
}
