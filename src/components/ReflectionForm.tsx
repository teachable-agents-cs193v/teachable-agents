"use client";

import { useState, type FormEvent } from "react";
import type { ConfidenceRating, SessionReflection } from "@/lib/types";
import { nowIso, cn } from "@/lib/utils";
import { Button } from "./ui/Button";
import { Field, inputClasses } from "./ui/Field";

interface ReflectionFormProps {
  postSessionPrompt: string;
  initial?: SessionReflection;
  onSubmit: (reflection: SessionReflection) => Promise<void> | void;
}

const CONFIDENCE_LABELS: Record<ConfidenceRating, string> = {
  1: "Not confident",
  2: "A little",
  3: "Somewhat",
  4: "Fairly",
  5: "Very confident",
};

/**
 * Student self-assessment. Everything captured here is the student's own
 * judgement; nothing is scored or graded by the app.
 */
export function ReflectionForm({ postSessionPrompt, initial, onSubmit }: ReflectionFormProps) {
  const [postExplanation, setPostExplanation] = useState(initial?.postExplanation ?? "");
  const [confidence, setConfidence] = useState<ConfidenceRating | null>(initial?.confidence ?? null);
  const [hardest, setHardest] = useState(initial?.hardestToExplain ?? "");
  const [misconceptionReflection, setMisconceptionReflection] = useState(initial?.misconceptionReflection ?? "");
  const [noticedGap, setNoticedGap] = useState<SessionReflection["noticedGap"] | null>(initial?.noticedGap ?? null);
  const [noticedGapDetail, setNoticedGapDetail] = useState(initial?.noticedGapDetail ?? "");
  const [freeReflection, setFreeReflection] = useState(initial?.freeReflection ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!postExplanation.trim()) next.postExplanation = "Give it a try, even a rough explanation helps.";
    if (confidence === null) next.confidence = "Pick a confidence level.";
    if (!hardest.trim()) next.hardest = "Name at least one thing that was hard to explain.";
    if (noticedGap === null) next.noticedGap = "Choose one.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || confidence === null || noticedGap === null) return;
    setSaving(true);
    try {
      await onSubmit({
        postExplanation: postExplanation.trim(),
        confidence,
        hardestToExplain: hardest.trim(),
        misconceptionReflection: misconceptionReflection.trim(),
        noticedGap,
        noticedGapDetail: noticedGapDetail.trim(),
        freeReflection: freeReflection.trim(),
        submittedAt: nowIso(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <Field
        id="post-explanation"
        label="Explain one key concept without notes"
        hint={postSessionPrompt}
      >
        <textarea
          id="post-explanation"
          rows={5}
          value={postExplanation}
          onChange={(e) => setPostExplanation(e.target.value)}
          aria-invalid={!!errors.postExplanation}
          aria-describedby={errors.postExplanation ? "post-explanation-error" : "post-explanation-hint"}
          className={cn(inputClasses, "paper-lines pl-14 leading-[1.9rem]", errors.postExplanation && "border-danger")}
          placeholder="Write it the way you would say it to Pip…"
        />
        {errors.postExplanation && <ErrorText id="post-explanation-error">{errors.postExplanation}</ErrorText>}
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium text-charcoal">How confident are you in your explanation?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-describedby={errors.confidence ? "confidence-error" : undefined}>
          {([1, 2, 3, 4, 5] as ConfidenceRating[]).map((n) => {
            const selected = confidence === n;
            return (
              <label
                key={n}
                className={cn(
                  "focus-ring flex cursor-pointer flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-sm transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-forest/60",
                  selected ? "border-forest bg-forest text-ivory" : "border-line bg-paper text-charcoal hover:border-forest/50",
                )}
              >
                <input
                  type="radio"
                  name="confidence"
                  value={n}
                  checked={selected}
                  onChange={() => setConfidence(n)}
                  className="sr-only"
                />
                <span className="font-display text-2xl leading-none">{n}</span>
                <span className={cn("text-xs", selected ? "text-ivory/80" : "text-muted")}>{CONFIDENCE_LABELS[n]}</span>
              </label>
            );
          })}
        </div>
        {errors.confidence && <ErrorText id="confidence-error">{errors.confidence}</ErrorText>}
      </fieldset>

      <Field id="hardest" label="What was hardest to explain?">
        <input
          id="hardest"
          type="text"
          value={hardest}
          onChange={(e) => setHardest(e.target.value)}
          aria-invalid={!!errors.hardest}
          aria-describedby={errors.hardest ? "hardest-error" : undefined}
          className={cn(inputClasses, errors.hardest && "border-danger")}
          placeholder="e.g. Why mutually exclusive events are not independent"
        />
        {errors.hardest && <ErrorText id="hardest-error">{errors.hardest}</ErrorText>}
      </Field>

      <Field
        id="misconception-reflection"
        label="Pip got some things wrong. Did any of those mistakes make you unsure about your own understanding?"
        optional
      >
        <textarea
          id="misconception-reflection"
          rows={3}
          value={misconceptionReflection}
          onChange={(e) => setMisconceptionReflection(e.target.value)}
          className={inputClasses}
          placeholder="Which misconception was hardest to argue against, and why?"
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium text-charcoal">
          Did teaching Pip help you notice something you did not fully understand?
        </legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-describedby={errors.noticedGap ? "noticed-gap-error" : undefined}>
          {(
            [
              ["yes", "Yes"],
              ["no", "No"],
              ["unsure", "Not sure"],
            ] as const
          ).map(([value, label]) => {
            const selected = noticedGap === value;
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-forest/60",
                  selected ? "border-forest bg-forest text-ivory" : "border-line bg-paper text-charcoal hover:border-forest/50",
                )}
              >
                <input
                  type="radio"
                  name="noticed-gap"
                  value={value}
                  checked={selected}
                  onChange={() => setNoticedGap(value)}
                  className="sr-only"
                />
                {label}
              </label>
            );
          })}
        </div>
        {errors.noticedGap && <ErrorText id="noticed-gap-error">{errors.noticedGap}</ErrorText>}
        {noticedGap === "yes" && (
          <div className="animate-fade-up">
            <label htmlFor="noticed-gap-detail" className="sr-only">What did you notice?</label>
            <textarea
              id="noticed-gap-detail"
              rows={2}
              value={noticedGapDetail}
              onChange={(e) => setNoticedGapDetail(e.target.value)}
              className={inputClasses}
              placeholder="What did you notice?"
            />
          </div>
        )}
      </fieldset>

      <Field id="free-reflection" label="Anything else about how the session went?" optional>
        <textarea
          id="free-reflection"
          rows={3}
          value={freeReflection}
          onChange={(e) => setFreeReflection(e.target.value)}
          className={inputClasses}
          placeholder="What would you do differently next time you teach this?"
        />
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : initial ? "Update reflection" : "Save reflection"}
        </Button>
        <p className="text-sm text-muted">Your answers are stored with this session so you can look back later.</p>
      </div>
    </form>
  );
}

function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-sm font-medium text-danger">
      {children}
    </p>
  );
}
