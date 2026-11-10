import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function base(props: IconProps) {
  const { title, ...rest } = props;
  return {
    rest: {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
      "aria-hidden": title ? undefined : true,
      role: title ? "img" : undefined,
      ...rest,
    },
    title,
  };
}

export function BookIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M8 7h8M8 10.5h5" />
      <path d="M6.5 18H20v3H6.5a1.5 1.5 0 0 1 0-3z" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="m14 7 3 3M5 16l3 3" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M5 19c0-8 5-13 14-14-.5 9-5.5 14-14 14z" />
      <path d="M5 19c3-4 6-7 10-10" />
    </svg>
  );
}

export function LightbulbIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M9 18h6M10 21h4" />
      <path d="M8 13.5A5.5 5.5 0 1 1 16 13.5c-.8.8-1.3 1.6-1.5 2.5h-5c-.2-.9-.7-1.7-1.5-2.5z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M4 12 20 4l-4 16-4-7z" />
      <path d="m12 13 8-9" />
    </svg>
  );
}

export function QuestionIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" />
    </svg>
  );
}

/* ---- Subject icons ---- */

export function DiceIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function CurveIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M4 4v16h16" />
      <path d="M7 8c3 1 5 4 10 9M17 7c-4 1-7 4-10 10" />
    </svg>
  );
}

export function BracesIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M9 4c-2 0-3 1-3 3v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 2 1 3 3 3" />
      <path d="M15 4c2 0 3 1 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 2-1 3-3 3" />
    </svg>
  );
}

export function MindIcon(props: IconProps) {
  const { rest, title } = base(props);
  return (
    <svg {...rest}>
      {title && <title>{title}</title>}
      <path d="M9 21v-3.5A6.5 6.5 0 0 1 5 11.5V10a6 6 0 0 1 12 0c0 1.5.8 2.4 1.7 3.4.4.4.1 1.1-.5 1.1H17v2a2 2 0 0 1-2 2h-1v2.5" />
      <path d="M11 9.5a1.5 1.5 0 1 1 2.2 1.3c-.5.3-.7.6-.7 1.2" />
    </svg>
  );
}

export const SUBJECT_ICONS = {
  probability: DiceIcon,
  economics: CurveIcon,
  biology: LeafIcon,
  "computer-science": BracesIcon,
  psychology: MindIcon,
} as const;
