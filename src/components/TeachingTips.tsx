import { LightbulbIcon } from "./illustrations/Icons";
import { cn } from "@/lib/utils";

interface TeachingTipsProps {
  tips: readonly string[];
  title?: string;
  className?: string;
  compact?: boolean;
}

export function TeachingTips({ tips, title = "Teaching tips", className, compact = false }: TeachingTipsProps) {
  return (
    <section className={cn("rounded-2xl bg-butter/60 p-4", className)} aria-labelledby="teaching-tips-title">
      <h3 id="teaching-tips-title" className="flex items-center gap-2 font-semibold text-charcoal">
        <LightbulbIcon className="text-terracotta" />
        {title}
      </h3>
      <ol className={cn("mt-3 flex flex-col gap-2.5", compact ? "text-sm" : "text-[15px]")}>
        {tips.map((tip, i) => (
          <li key={tip} className="flex gap-3 leading-relaxed text-charcoal/90">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-paper text-xs font-bold text-terracotta">
              {i + 1}
            </span>
            <span>{tip}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
