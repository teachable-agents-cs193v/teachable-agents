"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DETAILS_HREF } from "@/lib/aiData";
import { getSessionStore } from "@/lib/persistence";
import type { TeachingSession } from "@/lib/types";
import { SessionCard } from "@/components/SessionCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadErrorState } from "@/components/LoadErrorState";
import { DoodleBookOpen } from "@/components/illustrations/Doodles";
import { studentMessage } from "@/lib/errors";

export function SessionsDashboard() {
  const [sessions, setSessions] = useState<TeachingSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessionStore()
      .listSessions()
      .then((all) => {
        if (!cancelled) setSessions(all);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(studentMessage(error, "Please try again."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) return <LoadErrorState message={loadError} />;

  if (sessions === null) {
    return (
      <div className="py-20 text-center text-muted" role="status">
        Loading your sessions…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Nothing taught yet."
        actions={
          <Button href="/topics">
            <DoodleBookOpen className="size-5" /> Browse the library
          </Button>
        }
      >
        Your completed and in-progress sessions will show up here. Pip is waiting on the first lesson.
      </EmptyState>
    );
  }

  const removed = (id: string) => () => setSessions((all) => all?.filter((s) => s.id !== id) ?? null);
  const active = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="flex flex-col gap-10">
      {active.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="active-title">
          <h2 id="active-title" className="font-display text-2xl text-charcoal">In progress</h2>
          <div className="flex flex-col gap-3">
            {active.map((s) => (
              <SessionCard key={s.id} session={s} onDeleted={removed(s.id)} />
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-4" aria-labelledby="completed-title">
        <h2 id="completed-title" className="font-display text-2xl text-charcoal">
          Completed <span className="text-base font-sans text-muted">({completed.length})</span>
        </h2>
        {completed.length === 0 ? (
          <p className="text-muted">No completed sessions yet. Finish the one above to see it here.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {completed.map((s) => (
              <SessionCard key={s.id} session={s} onDeleted={removed(s.id)} />
            ))}
          </div>
        )}
      </section>
      <p className="text-xs text-muted">
        Sessions are saved to your account, so they follow you to any browser you log in from. Delete removes a
        session from our database for good. <Link href={DETAILS_HREF} className="focus-ring rounded font-medium text-forest underline underline-offset-2">What we keep, and what goes to the AI</Link>
      </p>
    </div>
  );
}
