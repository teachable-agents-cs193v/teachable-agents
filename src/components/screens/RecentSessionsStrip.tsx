"use client";

import { useEffect, useState } from "react";
import { getSessionStore } from "@/lib/persistence";
import type { TeachingSession } from "@/lib/types";
import { SessionCard } from "@/components/SessionCard";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** Landing-page strip showing the most recent sessions, if any exist in this browser. */
export function RecentSessionsStrip() {
  const [sessions, setSessions] = useState<TeachingSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessionStore()
      .listSessions()
      .then((all) => {
        if (!cancelled) setSessions(all.slice(0, 2));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sessions || sessions.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="recent-sessions">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Pick up where you left off" title={<span id="recent-sessions">Your recent sessions</span>} />
          <Button href="/sessions" variant="outline" size="sm">
            See all sessions
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
