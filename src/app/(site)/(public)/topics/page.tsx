import type { Metadata } from "next";
import { TopicLibrary } from "@/components/screens/TopicLibrary";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DoodleBookOpen } from "@/components/illustrations/Doodles";

export const metadata: Metadata = { title: "Topic library" };

export default function TopicsPage() {
  return (
    <>
      <section className="border-b border-sage bg-mint">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6">
          <Eyebrow>
            <DoodleBookOpen className="size-6" /> Lessons
          </Eyebrow>
          <h1 className="type-h1 text-forest">What will you teach today?</h1>
          <p className="type-lead max-w-2xl text-muted">
            Each shelf holds a concept students commonly half-understand. Pick one, meet Pip, and
            find out how well you can explain it.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <TopicLibrary />
      </section>
    </>
  );
}
