import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhyPip } from "@/components/landing/WhyPip";
import { ExampleConversation } from "@/components/landing/ExampleConversation";
import { FinalCta } from "@/components/landing/FinalCta";
import { RecentSessionsStrip } from "@/components/screens/RecentSessionsStrip";

/**
 * The public landing page. A logged-in student still lands here for now and
 * sees their recent sessions below the fold; the dedicated dashboard arrives
 * in the next PR, after which this page redirects them there.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyPip />
      <ExampleConversation />
      <RecentSessionsStrip />
      <FinalCta />
    </>
  );
}
