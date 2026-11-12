import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { safeNextPath } from "@/lib/auth/nextPath";
import { getCurrentUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined);
  // Already logged in: carry on to where they were going.
  if (await getCurrentUser()) redirect(nextPath ?? "/topics");
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <LoginScreen next={nextPath} />
      </main>
      <Footer />
    </>
  );
}
