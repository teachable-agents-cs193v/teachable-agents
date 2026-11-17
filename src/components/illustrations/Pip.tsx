import type { LearnerMood } from "@/lib/types";

/**
 * Pip, drawn by hand: a student with a soft D-shaped bob (a dome on top and a
 * straight hem at the jaw), a round face and a sage collar. Approved in the
 * Nov 2026 character review after four rounds.
 *
 * Everything that shows Pip builds on `PipHead`, a 64×64 group centred on the
 * face at (32, 36), so the character looks the same at 32px in a chat row and
 * at 88px on the About page. Every stroke is the same 2-unit ink line (hair,
 * face, brows, mouth and the mood marks alike); only brows, eyes and mouth
 * change between moods, so Pip stays recognisably one character.
 */

export const INK = "#222222";
const PAPER = "#fffefb";
const SAGE = "#dde9df";
const LEAF = "#4d8b6a";

const stroke = { stroke: INK, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const line = { fill: "none", ...stroke } as const;

/** The hair's dome: sides and top. The hem closes it behind the face. */
const DOME = "M14.6 48.6V34.4c0-12 7.8-20.6 17.4-20.6s17.4 8.6 17.4 20.6v14.2";
const HEM = "c0 1.3-.9 2.3-2.2 2.4-10.1.6-20.3.6-30.4 0-1.3-.1-2.2-1.1-2.2-2.4z";
/** The bowl fringe, from the right side of the face to the left, dipping a little in the middle. */
const FRINGE = "c-4.3 1.8-8.6 2.6-13 2.6s-8.7-.8-13-2.6";

/** The face and hair, as a `<g>` for composing into other drawings. */
export function PipHead({ mood = "curious" }: { mood?: LearnerMood }) {
  return (
    <g>
      {/* Hair, behind the face: one dome with a straight hem */}
      <path d={`${DOME}${HEM}`} fill={SAGE} {...stroke} />
      {/* Face */}
      <path d="M18 36.4c0-9.8 6.2-16.8 14-16.8s14 7 14 16.8c0 9.4-6.2 15.8-14 15.8S18 45.8 18 36.4z" fill={PAPER} {...stroke} />
      {/* Fringe over the forehead; its fill shares the dome's outline, and the
          outline is stroked again on top so the fill never thins it */}
      <path d={`${DOME}L49.4 31L45 28.8${FRINGE}L14.6 31L14.6 48.6z`} fill={SAGE} />
      <path d={`M45 28.8${FRINGE}`} {...line} />
      <path d={DOME} {...line} />
      <Face mood={mood} />
    </g>
  );
}

function Face({ mood }: { mood: LearnerMood }) {
  switch (mood) {
    case "thinking":
      return (
        <g>
          {/* eyes glance up and to the side; one brow lifts */}
          <path d="M23 34.6c1.8-1.2 3.8-1.2 5.6-.4M35.8 32.6c1.8-1.4 3.8-1.4 5.6-.2" {...line} />
          <circle cx="26.6" cy="38.6" r="2.2" fill={INK} />
          <circle cx="39" cy="38.2" r="2.2" fill={INK} />
          {/* pursed, slightly to the side */}
          <path d="M30.6 45.8c1.6.4 3.2.3 4.6-.4" {...line} />
          {/* thought dots drifting up */}
          <circle cx="51" cy="25" r="1.3" fill={LEAF} />
          <circle cx="54.6" cy="20" r="1.8" fill={LEAF} />
          <circle cx="59.2" cy="13.6" r="2.4" fill={LEAF} />
        </g>
      );
    case "confused":
      return (
        <g>
          {/* one brow flat, one up */}
          <path d="M22.8 35.4c1.8-.6 3.8-.6 5.6-.2M35.6 32.8c1.8-1.8 3.8-1.9 5.6-.6" {...line} />
          <circle cx="25.8" cy="39.8" r="2.2" fill={INK} />
          <circle cx="38.2" cy="39.6" r="2.2" fill={INK} />
          {/* a wobbly mouth */}
          <path d="M29 45.8c1.2-1.2 2.2-1.2 3.2 0s2 1.2 3.2 0" {...line} />
          {/* a small question mark by the temple */}
          <path d="M51.6 21.6c-.2-3.4 5-4 5.4-.6.3 2.4-2.4 2.6-2.4 5" {...line} stroke={LEAF} />
          <circle cx="54.4" cy="29.8" r="1.2" fill={LEAF} />
        </g>
      );
    case "happy":
      return (
        <g>
          <path d="M22.8 33.8c1.8-1.4 3.8-1.6 5.6-.6M35.6 33.2c1.8-1 3.8-.8 5.6.6" {...line} />
          {/* closed, delighted eyes */}
          <path d="M23.2 40c1.4-2.6 3.8-2.7 5.4-.2M35.4 39.8c1.4-2.6 3.8-2.7 5.4-.2" {...line} />
          {/* an open smile */}
          <path d="M28 44.8c2 3.6 6 3.6 8 0-2.6.5-5.4.5-8 0z" fill={INK} {...stroke} />
          {/* excited ticks */}
          <path d="M51.4 15.4l3.2-3.6M54 22.6l4.6-1M47.8 10.6l1.2-4.4" {...line} stroke={LEAF} />
        </g>
      );
    case "curious":
    default:
      return (
        <g>
          {/* brows lifted: listening */}
          <path d="M22.8 34.4c1.8-1.4 3.8-1.6 5.6-.6M35.6 33.8c1.8-1 3.8-.8 5.6.6" {...line} />
          <circle cx="25.8" cy="39.6" r="2.3" fill={INK} />
          <circle cx="38.2" cy="39.6" r="2.3" fill={INK} />
          <path d="M29.4 45.4c1.6 1.6 3.6 1.6 5.2 0" {...line} />
        </g>
      );
  }
}

/** Shoulders in a sage collar, for the 64×64 avatar. Drawn before the head. */
export function PipShoulders() {
  return <path d="M12 66c1.6-8.4 8.6-13.4 20.4-13.4 11.4 0 18.2 5 19.8 13.4" fill={SAGE} {...stroke} />;
}
