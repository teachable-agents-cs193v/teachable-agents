"use client";

import { useEffect, useState } from "react";
import { ChatIcon, ClockIcon } from "./illustrations/Icons";
import { cn } from "@/lib/utils";

interface SessionProgressProps {
  startedAt: string;
  endedAt?: string;
  studentMessages: number;
  learnerMessages: number;
  className?: string;
}

function elapsedLabel(startedAt: string, endedAt?: string, now = Date.now()): string {
  const end = endedAt ? new Date(endedAt).getTime() : now;
  const mins = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60000));
  if (mins < 1) return "<1 min";
  return `${mins} min`;
}

/** Live counters for the workspace header. Observed activity only, no scoring. */
export function SessionProgress({ startedAt, endedAt, studentMessages, learnerMessages, className }: SessionProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [endedAt]);

  return (
    <dl className={cn("flex items-center gap-4 text-sm text-muted", className)}>
      <div className="flex items-center gap-1.5">
        <dt className="sr-only">Elapsed time</dt>
        <ClockIcon className="size-4" />
        <dd>{elapsedLabel(startedAt, endedAt, now)}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt className="sr-only">Messages exchanged</dt>
        <ChatIcon className="size-4" />
        <dd>
          <span className="font-medium text-charcoal">{studentMessages}</span> from you ·{" "}
          <span className="font-medium text-charcoal">{learnerMessages}</span> from Pip
        </dd>
      </div>
    </dl>
  );
}
