import zxcvbn from "zxcvbn";

/**
 * Password strength via zxcvbn, ported from Anahi's A10 project. The signup
 * check enforces it on the server; the signup form may reuse it to show the
 * same feedback while typing. Nothing here is secret.
 */

export const MIN_SCORE = 3; // out of 4
export const SCORE_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;
/** zxcvbn slows down sharply on long input, so only this much is checked. */
const MAX_CHECKED_CHARS = 72;
const MAX_SUGGESTIONS = 4;

/** Words specific to this site that zxcvbn should treat as easy to guess. */
export const SITE_WORDS = ["protege", "pip", "teachable", "agents"];

export interface StrengthResult {
  score: number;
  label: (typeof SCORE_LABELS)[number];
  ok: boolean;
  warning: string;
  suggestions: string[];
}

const TIPS = {
  common: "Avoid common passwords, phrases, and passwords that have appeared in data breaches.",
  userInputs: "Avoid using your name, your email address, or the name of this site.",
  l33t: "Avoid predictable substitutions like replacing 'a' with '@' or 'o' with '0'.",
  caps: "Capitalization doesn't help very much on its own.",
  reversed: "Reversed words aren't much harder to guess.",
  dates: "Avoid dates and years, especially ones associated with you.",
  sequence: "Avoid predictable sequences like abc or 6543.",
  repeat: "Avoid repeated words and characters.",
  spatial: "Avoid keyboard patterns like qwerty or asdf.",
  moreWords: "Add another word or two. Uncommon words are better.",
  passphrase: "Consider using a longer passphrase made of several unrelated words.",
};

/**
 * zxcvbn only explains the weakest part of a password, so look at every part
 * it found and add a tip for each kind of weakness, in the order they appear.
 */
function tipsFromMatches(sequence: zxcvbn.ZXCVBNResult["sequence"]): string[] {
  const tips: string[] = [];
  for (const m of sequence) {
    if (m.pattern === "dictionary") {
      if (m.dictionary_name === "user_inputs") tips.push(TIPS.userInputs);
      else if (m.dictionary_name === "passwords") tips.push(TIPS.common);
      if (m.l33t) tips.push(TIPS.l33t);
      if (m.reversed) tips.push(TIPS.reversed);
      if (/[A-Z]/.test(m.token)) tips.push(TIPS.caps);
    } else if (m.pattern === "date" || (m as { regex_name?: string }).regex_name === "recent_year") {
      // zxcvbn sets regex_name at runtime, but @types/zxcvbn doesn't declare it.
      tips.push(TIPS.dates);
    } else if (m.pattern === "sequence") tips.push(TIPS.sequence);
    else if (m.pattern === "repeat") tips.push(TIPS.repeat);
    else if (m.pattern === "spatial") tips.push(TIPS.spatial);
  }
  return tips;
}

/** Normalizes zxcvbn's wording so its suggestions and ours dedupe against each other. */
const SAME_AS: [RegExp, string][] = [
  [/^add another word/i, TIPS.moreWords],
  [/capitalization/i, TIPS.caps],
  [/substitutions/i, TIPS.l33t],
  [/^avoid sequences/i, TIPS.sequence],
  [/^avoid repeated/i, TIPS.repeat],
  [/^avoid (dates|recent years)/i, TIPS.dates],
  [/^reversed/i, TIPS.reversed],
  [/keyboard pattern/i, TIPS.spatial],
];
const canonical = (s: string) => SAME_AS.find(([re]) => re.test(s.trim()))?.[1] ?? s.trim();

/**
 * Scores a password and explains how to improve it. The result never includes
 * the password or any piece of it. `userInputs` are words specific to this
 * user (name, email) that zxcvbn should treat as easy to guess.
 */
export function checkStrength(password: string, userInputs: string[] = []): StrengthResult {
  const checked = [...password].slice(0, MAX_CHECKED_CHARS).join("");
  const { score, feedback, sequence } = zxcvbn(checked, userInputs.filter(Boolean));
  const label = SCORE_LABELS[score];
  const ok = score >= MIN_SCORE;
  if (ok) return { score, label, ok, warning: "", suggestions: [] };

  // Specific advice first: zxcvbn's own (it targets the weakest part), then
  // tips for the other weaknesses it found. General advice goes last, and the
  // passphrase tip only when there's little specific to say.
  const specific = [...new Set([...feedback.suggestions, ...tipsFromMatches(sequence)].map(canonical))].filter(
    (s) => s && s !== TIPS.moreWords,
  );
  const general = specific.length >= 2 ? [TIPS.moreWords] : [TIPS.moreWords, TIPS.passphrase];
  const warning = feedback.warning ? feedback.warning.replace(/\.?$/, ".") : "";
  return { score, label, ok, warning, suggestions: [...specific, ...general].slice(0, MAX_SUGGESTIONS) };
}

/**
 * The words that count against a signup password: the name (whole, joined and
 * each part), the email, its local part (whole and split on . _ - +) and the
 * site words. zxcvbn only matches whole inputs, so "Jordan Lee" alone wouldn't
 * catch "jordanlee2026!".
 */
export function userInputsFor({ name, email }: { name?: string; email?: string }): string[] {
  const nameParts = name?.trim().split(/\s+/) ?? [];
  const local = email?.split("@")[0];
  const localParts = local?.split(/[._+-]+/) ?? [];
  const words = [name, nameParts.join(""), ...nameParts, email, local, ...localParts, ...SITE_WORDS];
  return [...new Set(words.filter((w): w is string => typeof w === "string" && w.length > 0))];
}
