import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ReflectionScreen } from "@/components/screens/ReflectionScreen";

export const metadata: Metadata = { title: "Reflect" };

export default async function ReflectPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <>
      <Navbar />
      <main className="flex flex-1 flex-col">
        <ReflectionScreen sessionId={sessionId} />
      </main>
      <Footer />
    </>
  );
}
