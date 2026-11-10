import Link from "next/link";
import type { Topic } from "@/lib/types";
import { accentStyle, getSubject } from "@/lib/subjects";
import { SUBJECT_ICONS, ArrowRightIcon, StarIcon } from "./illustrations/Icons";
import { Badge } from "./ui/Badge";

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const subject = getSubject(topic.subjectId);
  const Icon = SUBJECT_ICONS[topic.subjectId];
  return (
    <article
      style={accentStyle(subject)}
      className="card group relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      {/* Book-spine accent */}
      <div className="h-2 w-full" style={{ background: subject.accent }} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-2xl accent-bg accent-text">
            <Icon className="size-6" />
          </span>
          {topic.featured && (
            <Badge tone="butter">
              <StarIcon className="size-3.5" /> Featured demo
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] accent-text">{subject.label}</span>
          <h3 className="font-display text-2xl leading-snug text-charcoal">{topic.title}</h3>
          <p className="text-[15px] leading-relaxed text-muted">{topic.description}</p>
        </div>
        <div className="rounded-xl bg-ivory p-3 text-sm leading-relaxed text-charcoal/85">
          <span className="font-semibold accent-text">Objective: </span>
          {topic.learningObjective}
        </div>
        <div className="mt-auto pt-2">
          <Link
            href={`/learner/${topic.id}`}
            className="focus-ring inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[15px] font-medium text-ivory transition-colors hover:bg-forest-deep"
          >
            Teach This Topic
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
