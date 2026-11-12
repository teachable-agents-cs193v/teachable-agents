import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SignupScreen } from "@/components/screens/SignupScreen";
import { safeNextPath } from "@/lib/auth/nextPath";
import { getCurrentUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined);
  // Already logged in: carry on to where they were going.
  if (await getCurrentUser()) redirect(nextPath ?? "/topics");
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <SignupScreen next={nextPath} />
      </main>
      <Footer />
    </>
  );
}
