import type { ReactNode } from "react";
import type { LearnerMood } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { DoodleTicks } from "@/components/illustrations/Doodles";

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** One or two buttons. */
  actions?: ReactNode;
  mood?: LearnerMood;
  className?: string;
}

/** Pip waits in every empty state, so "nothing here yet" still has some personality. */
export function EmptyState({ title, children, actions, mood = "curious", className }: EmptyStateProps) {
  return (
    <div className={cn("card relative mx-auto flex max-w-xl flex-col items-center gap-4 overflow-hidden px-6 py-12 text-center", className)}>
      <DoodleTicks className="absolute right-8 top-6 size-8 rotate-12 text-leaf" />
      <LearnerAvatar mood={mood} size={104} animated />
      <h2 className="type-h3 text-forest">{title}</h2>
      {children && <div className="max-w-md leading-relaxed text-muted">{children}</div>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
