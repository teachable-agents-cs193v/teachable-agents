import type { LearnerMood } from "@/lib/types";

/**
 * Pip, drawn by hand: a curly-haired student in a sage shirt (style tile).
 *
 * Everything that shows Pip builds on `PipHead`, a 64×64 group centred on the
 * face at (32, 36), so the character looks the same at 32px in a chat row and
 * at 88px on the About page. Strokes are deliberately a little uneven: the curls
 * are overlapping arcs of slightly different sizes and the mouth and brows
 * are single loose strokes, so nothing reads as a clip-art icon.
 */

export const INK = "#222222";
const PAPER = "#fffefb";
const SAGE = "#dde9df";
const MINT = "#eef6ef";
const LEAF = "#4d8b6a";

const stroke = { stroke: INK, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Just the face and hair, as a `<g>` for composing into other drawings. */
export function PipHead({ mood = "curious" }: { mood?: LearnerMood }) {
  return (
    <g>
      {/* Face */}
      <path
        d="M18 36.5c-.3-9.4 5.8-16.3 14-16.4 8.6-.1 14.6 6.8 14.3 16.2C46 45.6 40 52.2 32.2 52c-8-.2-13.9-6.5-14.2-15.5z"
        fill={PAPER}
        {...stroke}
      />
      {/* Curls: a mass of overlapping bumps that sits on the face, with a
          scalloped hairline so the forehead is part of the drawing. */}
      <path
        d="M16.4 40.6c-2.8-2.2-3.4-5.8-1.4-8.6-2.4-2.6-1.6-6.6 1.4-8.2-.6-3.6 2-6.8 5.6-6.6 1-3.4 4.6-5.2 7.8-3.8 2.2-2.6 6.4-2.7 8.6 0 3.4-1.4 7 .6 7.8 4.2 3.6 0 6.2 3.4 5.4 7 3 1.8 3.6 5.8 1.2 8.4 1.8 2.8 1 6.4-1.8 8.2-.6-3.2-2.4-5-4.6-5.4-1.2-1.8-1.6-4.2-.6-5.8-2.2-.4-3.8-2-4-4-2.4 1-4.8.4-6.2-1.4-1.8 2-4.6 2.2-6.6.6-1 2.2-3.4 3.2-5.8 2.6-.4 2.2-2.2 4-4.6 4.2.8 2 .2 4.4-1.4 5.8-2 .6-3.8 2.4-4.4 4.8z"
        fill={MINT}
        {...stroke}
      />
      {/* a few loose curl strokes inside the mass */}
      <path d="M23 18.4c1.4-1.6 3.2-1.4 4.2.2M34.6 15.8c1.8-.8 3.4 0 4 1.8M18.8 26.8c-.2-2 1-3.4 2.8-3.4M43.4 24.6c1.6.2 2.6 1.6 2.4 3.4" fill="none" {...stroke} strokeWidth={1.5} opacity={0.7} />
      <Face mood={mood} />
    </g>
  );
}

function Face({ mood }: { mood: LearnerMood }) {
  const line = { fill: "none", ...stroke, strokeWidth: 2.1 } as const;
  switch (mood) {
    case "confused":
      return (
        <g>
          <circle cx="27" cy="38.5" r="1.7" fill={INK} />
          <circle cx="37.2" cy="38.2" r="1.7" fill={INK} />
          {/* one brow up, one flat */}
          <path d="M23.8 34.6c2-.8 4.2-.8 6.2-.2" {...line} />
          <path d="M34 32.4c2.2-2.2 4.6-2.3 6.6-.6" {...line} />
          {/* a wobbly mouth */}
          <path d="M28.4 45.4c1.4-1.5 2.6-1.5 3.8 0 1.2 1.3 2.4 1.2 3.6-.3" {...line} />
          {/* a small question mark floating by the ear */}
          <path d="M49.2 23.2c-.2-3.2 4.8-3.8 5.2-.6.3 2.4-2.4 2.6-2.4 5" {...line} strokeWidth={1.9} stroke={LEAF} />
          <circle cx="52" cy="31.2" r="1.1" fill={LEAF} />
        </g>
      );
    case "thinking":
      return (
        <g>
          {/* eyes glance up and to the side */}
          <circle cx="27.6" cy="37.4" r="1.6" fill={INK} />
          <circle cx="37.8" cy="37" r="1.6" fill={INK} />
          <path d="M24 33.4c2.2-1.2 4.4-1.3 6.4-.6" {...line} />
          <path d="M34.4 32.8c2.2-1.4 4.6-1.4 6.6-.4" {...line} />
          {/* pursed, slightly tilted */}
          <path d="M29 45.2c2.3.4 4.6.2 6.6-.6" {...line} />
          {/* thought dots drifting up */}
          <circle cx="49.5" cy="26" r="1.2" fill={LEAF} />
          <circle cx="53.2" cy="21" r="1.7" fill={LEAF} />
          <circle cx="58" cy="14.6" r="2.3" fill={LEAF} />
        </g>
      );
    case "happy":
      return (
        <g>
          {/* closed, delighted eyes */}
          <path d="M24.2 38.6c1.6-3 4-3.1 5.8-.2" {...line} />
          <path d="M34.6 38.3c1.6-3 4-3.1 5.8-.2" {...line} />
          <path d="M23.6 33.2c2.4-1.4 4.6-1.5 6.8-.5" {...line} />
          <path d="M34.2 32.8c2.4-1.4 4.6-1.5 6.8-.4" {...line} />
          {/* a big open smile */}
          <path d="M27.2 44c2.4 4.6 7.6 4.6 10 0-3.4.6-6.6.6-10 0z" {...line} fill={INK} strokeWidth={1.6} />
          {/* excited ticks */}
          <path d="M50 16.2l3.2-3.6M52.6 23.4l4.6-1M46.2 11.4l1.2-4.4" {...line} stroke={LEAF} strokeWidth={2.2} />
        </g>
      );
    case "curious":
    default:
      return (
        <g>
          <circle cx="27" cy="38.4" r="1.8" fill={INK} />
          <circle cx="37.2" cy="38.2" r="1.8" fill={INK} />
          {/* brows lifted: listening */}
          <path d="M23.6 33.4c2-2 4.4-2.1 6.6-.6" {...line} />
          <path d="M34.2 32.6c2.2-1.8 4.6-1.9 6.6-.3" {...line} />
          <path d="M28.6 44.6c2.4 2.4 5 2.4 7.4-.2" {...line} />
        </g>
      );
  }
}

/** Shoulders in a sage shirt, for the 64×64 avatar. */
export function PipShoulders() {
  return (
    <path d="M12 66c1.6-8.4 8.6-13.4 20.4-13.4 11.4 0 18.2 5 19.8 13.4" fill={SAGE} {...stroke} />
  );
}
