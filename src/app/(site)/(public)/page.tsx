import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhyPip } from "@/components/landing/WhyPip";
import { ExampleConversation } from "@/components/landing/ExampleConversation";
import { FinalCta } from "@/components/landing/FinalCta";
import { RecentSessionsStrip } from "@/components/screens/RecentSessionsStrip";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * The public landing page. Whether the visitor is logged in only decides where
 * "Start teaching" points (sign up first, or straight to the library). A
 * logged-in student still lands here for now and sees their recent sessions
 * below the fold; the dedicated dashboard arrives in the next PR, after which
 * this page redirects them there.
 */
export default async function HomePage() {
  const loggedIn = !!(await getCurrentUser());
  return (
    <>
      <Hero loggedIn={loggedIn} />
      <HowItWorks />
      <WhyPip />
      <ExampleConversation />
      <RecentSessionsStrip />
      <FinalCta loggedIn={loggedIn} />
    </>
  );
}
