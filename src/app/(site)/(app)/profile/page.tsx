import type { Metadata } from "next";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { LoadErrorState } from "@/components/LoadErrorState";
import { requireUser } from "@/lib/auth/server";
import { loadSessions } from "../loadSessions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const sessions = await loadSessions(user, "Profile");
  if (!sessions) return <LoadErrorState message="Please try again in a moment." />;
  return <ProfileScreen user={user} sessions={sessions} />;
}
