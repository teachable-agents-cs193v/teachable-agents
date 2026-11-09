import Link from "next/link";
import type { TeachingSession } from "@/lib/types";
import { getTopic } from "@/lib/topics";
import { accentStyle, getSubject } from "@/lib/subjects";
import { formatDate, formatDuration, summarizeSession } from "@/lib/utils";
import { SUBJECT_ICONS, ArrowRightIcon } from "./illustrations/Icons";
import { Badge } from "./ui/Badge";

interface SessionCardProps {
  session: TeachingSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const topic = getTopic(session.topicId);
  const summary = summarizeSession(session);
  const inProgress = session.status === "in_progress";
  const href = inProgress ? `/teach/${session.id}` : `/sessions/${session.id}`;

  if (!topic) {
    return (
      <article className="card p-5 text-sm text-muted">
        This session references a topic that no longer exists ({session.topicId}).
      </article>
    );
  }

  const subject = getSubject(topic.subjectId);
  const Icon = SUBJECT_ICONS[topic.subjectId];

  return (
    <article style={accentStyle(subject)} className="card flex flex-col gap-4 p-5 transition-all hover:shadow-lift sm:flex-row sm:items-center">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl accent-bg accent-text">
        <Icon className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] accent-text">{subject.label}</span>
          {inProgress ? <Badge tone="butter">In progress</Badge> : <Badge tone="sage">Completed</Badge>}
          {session.reflection && <Badge tone="neutral">Reflected</Badge>}
        </div>
        <h3 className="font-display text-xl text-charcoal">{topic.title}</h3>
        <p className="text-sm text-muted">
          {formatDate(session.startedAt)} · {summary.totalMessages} messages · {formatDuration(summary.durationMinutes)}
        </p>
      </div>
      <Link
        href={href}
        className="focus-ring inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-forest/30 px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-sage/50 sm:self-center"
      >
        {inProgress ? "Resume" : "Review"}
        <ArrowRightIcon className="size-4" />
      </Link>
    </article>
  );
}
