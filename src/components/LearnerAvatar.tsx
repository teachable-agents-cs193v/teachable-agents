import type { LearnerMood } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LearnerAvatarProps {
  mood?: LearnerMood;
  size?: number;
  className?: string;
  /** Adds a gentle idle animation. */
  animated?: boolean;
  label?: string;
}

/**
 * Pip: a small sprout-headed character drawn in SVG. The eyes and brows change
 * with mood so the learner reads as curious, confused, happy, or thinking.
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
      {/* sprout */}
      <path d="M32 14c0-6 3-9 8-10-1 5-3 8-8 10z" fill="#4e7a3f" />
      <path d="M32 14c0-6-3-9-8-10 1 5 3 8 8 10z" fill="#6c9a5c" />
      <path d="M32 14v5" stroke="#254d3c" strokeWidth="2" strokeLinecap="round" />
      {/* head */}
      <circle cx="32" cy="38" r="22" fill="#dde9dc" stroke="#254d3c" strokeWidth="2" />
      {/* cheeks */}
      <circle cx="20" cy="43" r="3.5" fill="#f1c3b1" opacity="0.8" />
      <circle cx="44" cy="43" r="3.5" fill="#f1c3b1" opacity="0.8" />
      <Face mood={mood} />
    </svg>
  );
}

function Face({ mood }: { mood: LearnerMood }) {
  const stroke = "#254d3c";
  switch (mood) {
    case "happy":
      return (
        <g stroke={stroke} strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M21 36c2-3 6-3 8 0" />
          <path d="M35 36c2-3 6-3 8 0" />
          <path d="M26 46c3 3 9 3 12 0" />
        </g>
      );
    case "confused":
      return (
        <g>
          <circle cx="25" cy="37" r="2.6" fill={stroke} />
          <circle cx="39" cy="37" r="2.6" fill={stroke} />
          <circle cx="25.9" cy="36.1" r="0.9" fill="#fff" />
          <circle cx="39.9" cy="36.1" r="0.9" fill="#fff" />
          <g stroke={stroke} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M21 30.5l7 1.5" />
            <path d="M36 31l7-2" />
            <path d="M27 47c2-1.5 5-1 7 0.5" />
          </g>
          <text x="48" y="28" fontSize="12" fontWeight="700" fill="#c77b63" fontFamily="serif">
            ?
          </text>
        </g>
      );
    case "thinking":
      return (
        <g>
          <circle cx="25" cy="37" r="2.6" fill={stroke} />
          <circle cx="39" cy="37" r="2.6" fill={stroke} />
          <circle cx="24" cy="36" r="0.9" fill="#fff" />
          <circle cx="38" cy="36" r="0.9" fill="#fff" />
          <g stroke={stroke} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M21 31h8" />
            <path d="M36 31l7-1.5" />
            <path d="M28 47h8" />
          </g>
          <circle cx="50" cy="24" r="1.6" fill="#c77b63" />
          <circle cx="54" cy="19" r="2.2" fill="#c77b63" opacity="0.7" />
        </g>
      );
    case "curious":
    default:
      return (
        <g>
          <circle cx="25" cy="37" r="2.8" fill={stroke} />
          <circle cx="39" cy="37" r="2.8" fill={stroke} />
          <circle cx="26" cy="36" r="1" fill="#fff" />
          <circle cx="40" cy="36" r="1" fill="#fff" />
          <g stroke={stroke} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M21 31c2-2 5-2 7 0" />
            <path d="M36 29.5c2-2 5-2 7 0" />
            <path d="M27 46.5c2 2 8 2 10 0" />
          </g>
        </g>
      );
  }
}
