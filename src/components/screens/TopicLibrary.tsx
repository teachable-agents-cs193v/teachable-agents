"use client";

import { useState } from "react";
import { TOPICS } from "@/lib/topics";
import type { SubjectId } from "@/lib/types";
import { TopicCard } from "@/components/TopicCard";
import { TopicFilters } from "@/components/TopicFilters";

export function TopicLibrary() {
  const [filter, setFilter] = useState<SubjectId | "all">("all");
  const counts = TOPICS.reduce<Record<string, number>>((acc, t) => {
    acc[t.subjectId] = (acc[t.subjectId] ?? 0) + 1;
    return acc;
  }, {});
  const visible = filter === "all" ? TOPICS : TOPICS.filter((t) => t.subjectId === filter);

  return (
    <div className="flex flex-col gap-8">
      <TopicFilters value={filter} onChange={setFilter} counts={counts} />
      <p className="sr-only" aria-live="polite">
        Showing {visible.length} {visible.length === 1 ? "topic" : "topics"}.
      </p>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((topic) => (
          <li key={topic.id} className="animate-fade-up">
            <TopicCard topic={topic} />
          </li>
        ))}
      </ul>
    </div>
  );
}
