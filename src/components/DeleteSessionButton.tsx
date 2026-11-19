"use client";

import { useState } from "react";
import { getSessionStore } from "@/lib/persistence";
import { Button } from "@/components/ui/Button";

/**
 * Delete, with a confirmation that says what goes: the whole session, from our database.
 * Calls DELETE /api/sessions/[id] through the session store, then `onDeleted`.
 */
export function DeleteSessionButton({ sessionId, topicTitle, onDeleted }: { sessionId: string; topicTitle: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await getSessionStore().deleteSession(sessionId);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The session couldn't be deleted. Try again.");
      setDeleting(false);
    }
  };

  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Delete session: ${topicTitle}`}>
        Delete
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Confirm deleting the session" className="flex basis-full flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
      <p className="leading-relaxed text-charcoal">
        <span className="font-semibold">Delete this session?</span> This permanently removes it from our database: your
        conversation with Pip, what you wrote before starting, Pip&rsquo;s notes and your reflection. It can&rsquo;t be undone.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="danger" onClick={() => void remove()} disabled={deleting}>
          {deleting ? "Deleting…" : "Yes, delete it"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
          Keep it
        </Button>
        {error && (
          <span role="alert" className="text-danger">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
