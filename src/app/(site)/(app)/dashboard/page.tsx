import type { Metadata } from "next";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { LoadErrorState } from "@/components/LoadErrorState";
import { requireUser } from "@/lib/auth/server";
import { loadSessions } from "../loadSessions";

export const metadata: Metadata = { title: "Home" };

/**
 * The logged-in home. Sessions are read on the server through the same
 * user-scoped store the API uses, so the first paint already has real data
 * and there is no loading state to flash.
 */
export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const sessions = await loadSessions(user, "Dashboard");
  if (!sessions) return <LoadErrorState message="Please try again in a moment." />;
  return <DashboardScreen user={user} sessions={sessions} />;
}
