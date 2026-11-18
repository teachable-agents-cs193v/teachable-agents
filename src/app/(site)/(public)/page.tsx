import { redirect } from "next/navigation";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhyPip } from "@/components/landing/WhyPip";
import { ExampleConversation } from "@/components/landing/ExampleConversation";
import { FinalCta } from "@/components/landing/FinalCta";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * The public landing page, for visitors only. A logged-in student is sent to
 * their dashboard instead: the marketing page has nothing for them, and the
 * dashboard is where their sessions are.
 */
export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyPip />
      <ExampleConversation />
      <FinalCta />
    </>
  );
}
