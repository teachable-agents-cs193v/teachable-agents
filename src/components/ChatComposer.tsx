"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SendIcon } from "./illustrations/Icons";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  /** Short helper text shown under the box. */
  hint?: string;
  autoFocus?: boolean;
}

const MAX_LENGTH = 2000;

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Explain it to Pip in your own words…",
  hint = "Enter to send · Shift+Enter for a new line",
  autoFocus = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with content up to a few lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus && !disabled) textareaRef.current?.focus();
  }, [autoFocus, disabled]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Write something for Pip before sending.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`Keep it under ${MAX_LENGTH} characters.`);
      return;
    }
    setError(null);
    setValue("");
    await onSend(trimmed);
    textareaRef.current?.focus();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) void submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!disabled) void submit();
    }
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" aria-label="Message composer">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-paper p-2 pl-4 shadow-soft transition-colors",
          error ? "border-danger/60" : "border-line focus-within:border-forest/60",
        )}
      >
        <label htmlFor="composer" className="sr-only">
          Your message to Pip
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          maxLength={MAX_LENGTH + 200}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "composer-error" : "composer-hint"}
          className="focus-ring max-h-[180px] min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-relaxed text-charcoal placeholder:text-muted/70 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl bg-forest text-ivory transition-colors hover:bg-forest-deep disabled:bg-sage disabled:text-forest/50"
        >
          <SendIcon />
        </button>
      </div>
      <div className="flex items-center justify-between px-1 text-xs text-muted">
        {error ? (
          <p id="composer-error" role="alert" className="font-medium text-danger">
            {error}
          </p>
        ) : (
          <p id="composer-hint">{hint}</p>
        )}
        <span aria-hidden="true" className={cn(value.length > MAX_LENGTH && "text-danger")}>
          {value.length > 0 ? `${value.length}/${MAX_LENGTH}` : ""}
        </span>
      </div>
    </form>
  );
}
