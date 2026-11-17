import type { LearnerMood } from "@/lib/types";

/**
 * Pip, drawn by hand: a curly-haired student in a sage shirt (style tile).
 *
 * Everything that shows Pip builds on `PipHead`, a 64×64 group centred on the
 * face at (32, 36), so the character looks the same at 32px in a chat row and
 * at 300px in the hero. Strokes are deliberately a little uneven: the curls
 * are overlapping arcs of slightly different sizes and the mouth and brows
 * are single loose strokes, so nothing reads as a clip-art icon.
 */

export const INK = "#222222";
const PAPER = "#fffefb";
const SAGE = "#dde9df";
const MINT = "#eef6ef";
const LEAF = "#4d8b6a";
const FOREST = "#204f3e";
const BUTTER = "#eadf9b";

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

/**
 * The hero drawing from the style tile: Pip, chin in hand, thinking beside a
 * stack of books with a sprout growing out of the top. 360×300 viewBox.
 */
export function PipThinkingScene({ className, title = "Pip, thinking hard, next to a stack of books" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 360 300" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      {/* a loose ground line */}
      <path d="M22 284c60-3 118-2 176-1 54 1 100 1 140-2" fill="none" {...stroke} strokeWidth={1.6} strokeDasharray="0 0" opacity={0.45} />

      {/* Book stack, slightly askew, with a sprout */}
      <g transform="translate(222 150)">
        <path d="M6 112l101-2c1-7-.4-13-2-19L4 93c-1.6 6.4-.6 12.6 2 19z" fill={FOREST} {...stroke} />
        <path d="M14 92l94-1.4c.8-6.6.4-12.4-1.2-18.4l-93 2c-1.8 6-1.2 11.8.2 17.8z" fill={PAPER} {...stroke} />
        <path d="M2 74l100-2.6c1.4-6.8.6-12.8-1.6-18.6L0 55c-.8 6.6 0 12.8 2 19z" fill={SAGE} {...stroke} />
        <path d="M12 54l92-1.8c1-6.2.2-12-1.8-17.4l-91 2.6c-1.6 5.6-.8 11.2.8 16.6z" fill={BUTTER} {...stroke} />
        {/* spine marks */}
        <path d="M22 100v5M30 100v5M26 80v4M20 62v5M30 62v5M22 42v4" fill="none" {...stroke} strokeWidth={1.8} />
        {/* sprout */}
        <path d="M60 36c-.6-9 1.4-17 6.2-24" fill="none" {...stroke} />
        <path d="M66.4 14c2.8-9 9.2-13.6 18.6-14-.8 9.2-7.2 14.6-18.6 14z" fill={LEAF} {...stroke} />
        <path d="M64.6 20.2c-5.6-5-12.6-6.4-20.4-4.2 3.4 7 10.6 9.4 20.4 4.2z" fill={SAGE} {...stroke} />
      </g>

      {/* Pip: neck and torso, then the head, then the arm and hand on top */}
      <g>
        <path d="M106 176h28v20h-28z" fill={PAPER} {...stroke} />
        <path d="M40 300c0-48 24-88 66-104 4-1.4 24-1.4 28 0 42 16 66 56 66 104" fill={SAGE} {...stroke} strokeWidth={2.4} />
        <path d="M100 198c8 10 32 10 40 0" fill="none" {...stroke} strokeWidth={2} />
        <g transform="translate(37 42) scale(2.6)">
          <PipHead mood="thinking" />
        </g>
        {/* forearm resting on the elbow, drawn as an outlined sleeve */}
        <path d="M178 296c8-36-2-74-30-110" fill="none" stroke={INK} strokeWidth={23} strokeLinecap="round" />
        <path d="M178 296c8-36-2-74-30-110" fill="none" stroke={SAGE} strokeWidth={18} strokeLinecap="round" />
        {/* cuff */}
        <path d="M142 196c6-2 12-1 16 3" fill="none" {...stroke} strokeWidth={1.8} />
        {/* hand tucked under the chin */}
        <path d="M128 182c10-10 24-8 28 4 2 8-6 16-16 14-9-1.6-16-9-12-18z" fill={PAPER} {...stroke} strokeWidth={2.2} />
        <path d="M136 190c2 2 5 2.6 8 1.6M140 196c2.4 1.4 5 1.4 7 .2" fill="none" {...stroke} strokeWidth={1.5} />
      </g>

      {/* Idea: lightbulb with excited ticks */}
      <g transform="translate(236 18)">
        <path d="M18 44c-5-4-8.4-9.4-8-16.4C10.8 14.6 20.6 7 30 8c10.4 1 16.8 9.4 16 19-.6 7-4.4 11.6-8.6 16-1.8 1.8-2.4 4.4-2.4 6.8H21c0-2.4-.8-4.8-3-5.8z" fill={BUTTER} {...stroke} />
        <path d="M22.5 56h12M24 61.5h9" fill="none" {...stroke} />
        <path d="M24 42c-2.6-5 .4-10 4.6-10 4.4 0 7 5 4.4 10" fill="none" {...stroke} strokeWidth={1.8} />
        <path d="M28 0v-8M50 10l5.6-5.4M6 10L.4 4.6M58 28h8M-2 28h-8" fill="none" {...stroke} stroke={LEAF} strokeWidth={2.4} />
      </g>
      {/* question ticks near the head */}
      <path d="M26 40l-6-8M14 58l-10-3" fill="none" {...stroke} stroke={LEAF} strokeWidth={2.4} />
    </svg>
  );
}
