"use client";

import { SUBJECTS } from "@/lib/subjects";
import type { SubjectId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopicFiltersProps {
  value: SubjectId | "all";
  onChange: (value: SubjectId | "all") => void;
  counts: Record<string, number>;
}

export function TopicFilters({ value, onChange, counts }: TopicFiltersProps) {
  const options: Array<{ id: SubjectId | "all"; label: string }> = [
    { id: "all", label: "All subjects" },
    ...SUBJECTS.map((s) => ({ id: s.id, label: s.label })),
  ];
  return (
    <div role="group" aria-label="Filter topics by subject" className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        const count = opt.id === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[opt.id] ?? 0;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-forest bg-forest text-ivory"
                : "border-line bg-paper text-charcoal hover:border-forest/50 hover:bg-sage/40",
            )}
          >
            {opt.label}
            <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-ivory/20" : "bg-ivory-deep text-muted")}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
