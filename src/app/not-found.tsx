import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { LearnerAvatar } from "@/components/LearnerAvatar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
        <LearnerAvatar mood="confused" size={96} />
        <h1 className="font-display text-4xl text-forest">Hmm, that page isn&rsquo;t in the library.</h1>
        <p className="text-lg text-muted">Even Pip is confused by this one. Let&rsquo;s head somewhere useful.</p>
        <div className="flex gap-3">
          <Button href="/topics">Browse topics</Button>
          <Button href="/" variant="outline">Go home</Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
