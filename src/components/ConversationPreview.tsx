import { LearnerAvatar } from "./LearnerAvatar";
import { cn } from "@/lib/utils";

const preview = [
  {
    role: "learner",
    mood: "confused",
    text: "Wait, I'm a little confused. If two events are independent, doesn't that mean they can't happen at the same time?",
  },
  {
    role: "student",
    text: "Not exactly. Independence means one event happening doesn't change the probability of the other.",
  },
  { role: "learner", mood: "curious", text: "Oh! So they can happen together? Can you give me an example?" },
  { role: "student", text: "Sure, flipping heads on a coin and rolling a six on a die." },
  {
    role: "learner",
    mood: "curious",
    text: "That helps! But why does knowing the coin landed on heads not change the chance of rolling a six?",
  },
] as const;

/** Static illustration of a teaching exchange for the landing page. */
export function ConversationPreview({ className }: { className?: string }) {
  return (
    <div className={cn("card relative overflow-hidden p-5 sm:p-6", className)} aria-label="Example teaching conversation">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <LearnerAvatar size={36} mood="curious" />
          <div className="leading-tight">
            <p className="font-semibold text-charcoal">Pip</p>
            <p className="text-xs text-muted">Learning: Independence vs. Mutual Exclusivity</p>
          </div>
        </div>
        <span className="rounded-full bg-butter px-2.5 py-1 text-xs font-semibold text-charcoal">You are teaching</span>
      </div>
      <ol className="flex flex-col gap-3">
        {preview.map((m, i) => (
          <li
            key={i}
            className={cn("flex items-end gap-2", m.role === "student" && "flex-row-reverse")}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            {m.role === "learner" ? (
              <LearnerAvatar size={28} mood={m.mood} />
            ) : (
              <span className="grid size-7 place-items-center rounded-full bg-butter text-[10px] font-bold text-forest" aria-hidden="true">
                You
              </span>
            )}
            <p
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "student"
                  ? "rounded-br-md bg-forest text-ivory"
                  : "rounded-bl-md border border-line bg-ivory text-charcoal",
              )}
            >
              <span className="sr-only">{m.role === "student" ? "You: " : "Pip: "}</span>
              {m.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
