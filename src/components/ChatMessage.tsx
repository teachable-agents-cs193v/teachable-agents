import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { LearnerAvatar } from "./LearnerAvatar";
import { Badge } from "./ui/Badge";

interface ChatMessageProps {
  message: ChatMessageType;
  learnerName?: string;
  /** Shows the scripted "misconception" tag on learner turns (useful when reviewing). */
  showTurnLabels?: boolean;
  animate?: boolean;
}

export function ChatMessage({ message, learnerName = "Pip", showTurnLabels = false, animate = true }: ChatMessageProps) {
  const isStudent = message.role === "student";
  return (
    <div
      className={cn("flex w-full gap-3", isStudent ? "flex-row-reverse" : "flex-row", animate && "animate-fade-up")}
      data-role={message.role}
    >
      {isStudent ? (
        <div
          className="grid size-10 shrink-0 place-items-center rounded-full bg-butter font-display text-base text-forest"
          aria-hidden="true"
        >
          You
        </div>
      ) : (
        <LearnerAvatar mood={message.mood} size={40} label={learnerName} />
      )}
      <div className={cn("flex max-w-[82%] flex-col gap-1.5 sm:max-w-[72%]", isStudent && "items-end")}>
        <div className="flex items-center gap-2 px-1 text-xs text-muted">
          <span className="font-semibold text-charcoal/80">{isStudent ? "You (teacher)" : learnerName}</span>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>
        <div
          className={cn(
            "rounded-bubble px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
            isStudent
              ? "rounded-tr-md bg-forest text-ivory"
              : "rounded-tl-md border border-line bg-paper text-charcoal shadow-soft",
          )}
        >
          {message.text}
        </div>
        {showTurnLabels && message.role === "learner" && message.misconception && (
          <Badge tone="terracotta" className="normal-case tracking-normal">
            Misconception: {message.misconception}
          </Badge>
        )}
      </div>
    </div>
  );
}
