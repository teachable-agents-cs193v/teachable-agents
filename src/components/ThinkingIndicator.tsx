import { LearnerAvatar } from "./LearnerAvatar";

export function ThinkingIndicator({ learnerName = "Pip" }: { learnerName?: string }) {
  return (
    <div className="flex items-end gap-3 animate-fade-up" role="status" aria-live="polite">
      <LearnerAvatar mood="thinking" size={40} label={learnerName} />
      <div className="flex items-center gap-1.5 rounded-bubble rounded-bl-md border border-line bg-paper px-4 py-3.5 shadow-soft">
        <span className="sr-only">{learnerName} is thinking</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-forest/70 animate-bounce-dot"
            style={{ animationDelay: `${i * 0.15}s` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
