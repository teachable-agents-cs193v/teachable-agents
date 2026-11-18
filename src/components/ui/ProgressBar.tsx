import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** 0 to 100. */
  value: number;
  label: string;
  /** Shown to the right, e.g. "60%" or "3 of 5". Defaults to the percentage. */
  valueText?: string;
  className?: string;
}

/**
 * The lesson-card progress bar from the tile: a sage track with a deep green
 * fill and a mono readout. Only for progress the backend actually reports;
 * never for invented learning metrics.
 */
export function ProgressBar({ value, label, valueText, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-sage"
      >
        <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${clamped}%` }} />
      </div>
      <span className="font-mono text-xs text-muted tabular-nums">{valueText ?? `${clamped}%`}</span>
    </div>
  );
}
