import type { SVGProps } from "react";

/**
 * Notebook doodles for the Pip design system (style tile, "Doodle Toolkit").
 *
 * These are drawn as loose, slightly uneven strokes on a 48×48 grid, with
 * fills limited to the palette (sage, mint, butter, leaf). They are decoration
 * and hidden from screen readers unless given a `title`. Functional UI icons
 * (arrows, check, send, clock) stay in Icons.tsx.
 */

type DoodleProps = SVGProps<SVGSVGElement> & { title?: string };

const INK = "currentColor";
const SAGE = "#dde9df";
const MINT = "#eef6ef";
const BUTTER = "#eadf9b";
const LEAF = "#4d8b6a";
const PAPER = "#fffefb";

function Svg({ title, children, ...rest }: DoodleProps) {
  return (
    <svg
      width={48}
      height={48}
      viewBox="0 0 48 48"
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function DoodleLightbulb(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M17.6 31c-3.4-2.8-5.8-6.4-5.4-11.2C12.8 12.4 18.4 7.6 24.4 8c7.4.4 11.6 6 11.2 12-.4 4.6-2.8 7.6-5.6 10.6-1.2 1.2-1.6 3-1.6 4.4h-9.8c0-1.6-.6-3.2-1-4z"
        fill={BUTTER}
      />
      <path d="M19.4 39h9.6M20.6 42.6h7.2" />
      <path d="M21 29.6c-1.6-3.4.4-6.8 3.2-6.8 3 0 4.8 3.4 3 6.8" strokeWidth={1.7} />
      <path d="M24 2.2v3.4M36.2 6.8l-2.4 2.4M11.8 6.8l2.4 2.4M42 19.4h-3.6M6 19.4h3.6" stroke={LEAF} strokeWidth={2.3} />
    </Svg>
  );
}

export function DoodleBookOpen(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M24 15c-4-3.4-9.6-4.4-16.2-3.2.4 8.6.2 17.4.4 26 6.4-.8 11.8.2 15.8 3.4 3.8-3.2 9.4-4.2 15.8-3.2.2-8.8.2-17.6.4-26.2-6.6-1.2-12.2-.2-16.2 3.2z"
        fill={PAPER}
      />
      <path d="M24 15v26.2" />
      <path d="M12.6 18.2c3.2-.4 6 .2 8.4 1.4M12.6 22.8c3.2-.4 6 .2 8.4 1.4M12.6 27.4c3 0 5.6.4 8 1.4M27 19.6c2.6-1.2 5.4-1.8 8.4-1.4M27 24.2c2.6-1.2 5.4-1.8 8.4-1.4" strokeWidth={1.5} />
      {/* bookmark ribbon */}
      <path d="M31.4 11.8v8.6l2.4-1.8 2.4 1.8v-9" fill={LEAF} stroke={LEAF} strokeWidth={1.4} />
    </Svg>
  );
}

export function DoodleBookStack(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M8.6 41l30-.6c.2-2.4-.2-4.6-.8-6.6l-29.8.8c-.4 2.2 0 4.4.6 6.4z" fill={SAGE} />
      <path d="M11.4 34l27.2-.4c.4-2.2.2-4.2-.2-6.2l-27 .6c-.6 2-.4 4 0 6z" fill={PAPER} />
      <path d="M9.6 27.6l28.6-1c.2-2.2-.2-4.2-.8-6l-28.6 1.2c-.2 2 .2 3.8.8 5.8z" fill={BUTTER} />
      <path d="M14.2 37.2v2M18 37.2v2M16 30v2M14 23.6v2M18 23.6v2" strokeWidth={1.6} />
      <path d="M24.2 20.4c-.2-3.2.6-5.8 2.2-8.2" />
      <path d="M26.6 12.8c1.8-4 4.8-5.6 8.6-5.6-.6 4-3.4 6.4-8.6 5.6z" fill={LEAF} />
      <path d="M25.6 14.4c-2.6-2.2-5.6-2.8-8.8-2 1.4 3.2 4.6 4.4 8.8 2z" fill={SAGE} />
    </Svg>
  );
}

export function DoodleSprout(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M24 42c-.4-9 1-16.6 4.4-23.6" />
      <path d="M28.8 18c2.4-7.2 7.6-10.6 15-10.4-1.4 7.4-6.6 11.6-15 10.4z" fill={LEAF} />
      <path d="M26.6 24c-4.4-4.2-9.6-5.4-15.4-3.8 2.6 5.6 8 7.8 15.4 3.8z" fill={SAGE} />
      <path d="M14 42.6c6.6-1 13.2-1 20 0" strokeWidth={1.6} />
    </Svg>
  );
}

export function DoodleQuestionBubble(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M10.4 12c0-2.8 2.4-4.8 5.2-4.8h17.6c2.8 0 5.2 2 5.2 4.8v13.4c0 2.8-2.4 4.8-5.2 4.8H21.6L13.4 37l.8-7c-2.4-.6-3.8-2.4-3.8-4.6z"
        fill={PAPER}
      />
      <path d="M20.4 15.8c0-3.4 2.8-4.8 5-4.6 2.4.2 4 2 3.8 4.2-.4 2.8-4 3-4 6" />
      <circle cx="25" cy="25.6" r="1.3" fill={INK} stroke="none" />
    </Svg>
  );
}

export function DoodleExclaimBubble(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M10.4 12c0-2.8 2.4-4.8 5.2-4.8h17.6c2.8 0 5.2 2 5.2 4.8v13.4c0 2.8-2.4 4.8-5.2 4.8H21.6L13.4 37l.8-7c-2.4-.6-3.8-2.4-3.8-4.6z"
        fill={BUTTER}
      />
      <path d="M24.4 12.2l-.4 8.4" strokeWidth={2.4} />
      <circle cx="24" cy="25.6" r="1.4" fill={INK} stroke="none" />
    </Svg>
  );
}

/** A loose curved arrow, like one drawn between notes. */
export function DoodleArrow(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M8 36.4c5.2-10.8 15.6-18.4 30.2-17.2" />
      <path d="M32.4 14l6.4 5.2-5.8 5.6" />
    </Svg>
  );
}

/** An arrow that loops back on itself: "try again" / "revise". */
export function DoodleArrowLoop(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M9.6 31.2c2-9.4 9.4-14.6 18.6-13.4 7 .8 10.8 5.4 9.8 11.2-.8 4.8-5.8 7.2-9.4 4.6-3-2.2-1.6-6.6 2-7.4 3.6-.8 7 1.8 8 5.6" />
      <path d="M33.4 27.4l5.4 4.4 1.6-6.6" />
    </Svg>
  );
}

/** Three short excited ticks, the tile's "\ | /" mark. */
export function DoodleTicks(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M24 8.4l.2 9.2M10.6 14.2l6.6 6.2M37.4 14.2l-6.6 6.2" stroke={LEAF} strokeWidth={2.6} />
    </Svg>
  );
}

export function DoodleStar(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M24 5.6c1.2 7.6 4.6 13.4 12.6 15.8-7.8 2.2-11.6 7.8-12.6 16.2-1.2-8.2-5-13.6-12.6-16 7.6-2.4 11.4-8.2 12.6-16z"
        fill={BUTTER}
      />
    </Svg>
  );
}

export function DoodleCheckbox(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M10.8 12.6c.2-2.4 1.6-3.6 3.8-3.6l19.6-.4c2.4 0 3.6 1.4 3.6 3.8l-.4 19.6c0 2.4-1.4 3.6-3.6 3.6l-19.8.2c-2.4 0-3.4-1.4-3.4-3.6z"
        fill={PAPER}
      />
      <path d="M16.4 24l6.4 6.2L34.4 16.6" stroke={LEAF} strokeWidth={2.6} />
    </Svg>
  );
}

export function DoodleBars(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M10.4 40l.4-12.8h5.4l-.4 12.8z" fill={SAGE} />
      <path d="M20.2 40l.4-20.6h5.4l-.4 20.6z" fill={LEAF} />
      <path d="M30 40l.4-16.2h5.4L35.4 40z" fill={SAGE} />
      <path d="M6 41.2c12-.6 24-.6 36 0" strokeWidth={1.8} />
    </Svg>
  );
}

export function DoodleLaptop(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M9.6 32V13.8c0-1.6 1-2.6 2.6-2.6h24.6c1.4 0 2.4 1 2.4 2.6V32" fill={MINT} />
      <path d="M4.6 33.4h38.8l-2.6 4.8H7.2z" fill={SAGE} />
      <path d="M17.4 19l-3.6 3.6 3.6 3.4M30.6 19l3.6 3.6-3.6 3.4M26.2 17.4l-4.4 11.4" strokeWidth={1.7} stroke={LEAF} />
    </Svg>
  );
}

export function DoodlePencil(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M11.4 37.2l2-8L32 10.6c1.8-1.8 4.6-1.8 6.4 0 1.8 1.8 1.8 4.6 0 6.4L19.8 35.4z" fill={BUTTER} />
      <path d="M13.4 29.2l6.2 6.2M28.6 14l6 6" />
    </Svg>
  );
}

/** A scribbled ring, for circling a word or number. */
export function DoodleRing(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M8.6 25c-1.4-9.2 8.8-15.6 18.4-14.6 9.2.8 14.8 7.2 13.2 14.2-1.6 7.4-10.6 12-19.4 11.2C12 35 9.6 30.6 8.6 25z M12 20c4-5.4 12-7.8 19-6" />
    </Svg>
  );
}

/* ---- Subject doodles (used on topic cards and session cards) ---- */

export function DoodleDice(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M10.4 13.2c0-2.6 1.6-4.2 4.2-4.2l19.2-.4c2.6 0 4.4 1.6 4.2 4.2l-.4 19.6c0 2.6-1.6 4.2-4.2 4.2l-19.4.2c-2.6 0-4-1.6-4-4.2z"
        fill={PAPER}
      />
      <circle cx="17.4" cy="16.4" r="1.6" fill={INK} stroke="none" />
      <circle cx="30.8" cy="16" r="1.6" fill={INK} stroke="none" />
      <circle cx="24.2" cy="22.8" r="1.6" fill={INK} stroke="none" />
      <circle cx="17.6" cy="29.6" r="1.6" fill={INK} stroke="none" />
      <circle cx="31" cy="29.4" r="1.6" fill={INK} stroke="none" />
    </Svg>
  );
}

export function DoodleCurve(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M9.6 8.4l.4 30.4 30-.4" />
      <path d="M14 12.6c5.4 9.6 11.8 16 22 21" stroke={LEAF} />
      <path d="M36 12.2c-8.2 7.4-14.6 14-21.8 21.4" />
      <circle cx="25" cy="23.2" r="2.2" fill={BUTTER} />
    </Svg>
  );
}

export function DoodleLeaf(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M10.4 38.4c-.6-14.4 10-25.2 28.2-26.8-1.2 15.2-9.8 25.8-28.2 26.8z" fill={SAGE} />
      <path d="M10.8 38c6.4-8.6 12.6-14.6 20.8-19.6" stroke={LEAF} />
    </Svg>
  );
}

export function DoodleBraces(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path d="M18.4 8.6c-4 0-6 2-6 6v6c0 2-2 4-4 4 2 0 4 2 4 4v6c0 4 2 6 6 6" />
      <path d="M29.6 8.6c4 0 6 2 6 6v6c0 2 2 4 4 4-2 0-4 2-4 4v6c0 4-2 6-6 6" />
      <path d="M21 25.4h6" stroke={LEAF} strokeWidth={2.6} />
    </Svg>
  );
}

export function DoodleMind(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path
        d="M19 42v-6.2c-5-1.2-8.4-5.4-8.4-10.6C10.6 18 16 12.4 23 12.4h3.6c6.4 0 11 4.8 11 10.6 0 2 1 3.6 2.6 5.6.6.8 0 1.8-1 1.8h-3.4v2.8c0 2-1.6 3.4-3.6 3.4h-2V42"
        fill={MINT}
      />
      <path d="M21.4 22.4c0-2.8 2.4-4 4.2-3.8 2 .2 3.4 1.8 3.2 3.6-.4 2.4-3.4 2.6-3.4 5" stroke={LEAF} strokeWidth={1.8} />
      <circle cx="25.2" cy="30.6" r="1.1" fill={LEAF} stroke="none" />
    </Svg>
  );
}

export const SUBJECT_DOODLES = {
  probability: DoodleDice,
  economics: DoodleCurve,
  biology: DoodleLeaf,
  "computer-science": DoodleBraces,
  psychology: DoodleMind,
} as const;
