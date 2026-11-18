import type { LearnerMood } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PipHead, PipShoulders } from "./illustrations/Pip";

interface LearnerAvatarProps {
  mood?: LearnerMood;
  size?: number;
  className?: string;
  /** Adds a gentle idle animation. */
  animated?: boolean;
  label?: string;
}

/**
 * Pip at avatar size: head and shoulders, with the eyes, brows and mouth
 * changing by mood so the learner reads as curious, confused, thinking, or
 * happy. The drawing itself lives in illustrations/Pip.tsx.
 */
export function LearnerAvatar({
  mood = "curious",
  size = 56,
  className,
  animated = false,
  label = "Pip, your learner",
}: LearnerAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${label} (${mood})`}
      className={cn("shrink-0", animated && "animate-wiggle origin-bottom", className)}
    >
      <PipShoulders />
      <PipHead mood={mood} />
    </svg>
  );
}
