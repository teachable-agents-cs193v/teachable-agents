/**
 * Everything the app tells students about the AI provider, in one place (the "Where your words go"
 * card, the in-session line and the /ai-data page), plus the learner ids that record each
 * session's choice. Safe to import from the browser and the server.
 *
 * Facts about Groq come only from the pages in GROQ_SOURCES, as checked on SOURCES_CHECKED.
 * Re-check them before changing any wording here.
 */

/**
 * Set to true only after Zero Data Retention is turned on for our Groq organization
 * (Groq console → Settings → Data Controls). It changes what we say Groq keeps.
 */
export const ZDR_ENABLED = false;

export const PROVIDER = "Groq";

/** The models Pip's AI calls use (LLM_MODEL_* in the deployment). Open models that Groq runs. */
export const MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"] as const;

export const SOURCES_CHECKED = "November 19, 2026";

export const GROQ_SOURCES = [
  { label: "Groq: Your data in GroqCloud", href: "https://console.groq.com/docs/your-data" },
  { label: "Groq Privacy Policy (effective November 12, 2025)", href: "https://groq.com/privacy-policy" },
  { label: "Groq Services Agreement (last modified June 22, 2026)", href: "https://console.groq.com/docs/legal/services-agreement" },
] as const;

export const DETAILS_HREF = "/ai-data";

/* ------------------------------ The choice ------------------------------ */

/** What a student chooses when starting a session. */
export type LearnerMode = "ai" | "offline";

/**
 * Stored in teaching_sessions.learner_id when the session is created (no migration needed).
 * "pip" is also what every session created before this choice existed has, so those keep the AI
 * learner they started with. Any other value means no AI: see aiAllowed().
 */
export const AI_LEARNER_ID = "pip";
export const OFFLINE_LEARNER_ID = "pip-offline";

export const learnerIdFor = (mode: LearnerMode) => (mode === "ai" ? AI_LEARNER_ID : OFFLINE_LEARNER_ID);

/** True only for sessions whose student chose AI Pip. Unknown ids fail closed (no AI). */
export const aiAllowed = (learnerId: string) => learnerId === AI_LEARNER_ID;

export const modeOf = (learnerId: string): LearnerMode => (aiAllowed(learnerId) ? "ai" : "offline");

/** localStorage key for this browser's last choice (only a default; the card is shown every time). */
export const LAST_CHOICE_KEY = "protege:learner-choice";

/* ------------------------------- The copy ------------------------------- */

/** What Groq keeps of a message's content, depending on ZDR_ENABLED. */
export const RETENTION = ZDR_ENABLED
  ? `${PROVIDER} doesn't keep your messages after answering. We've turned on Zero Data Retention, so it doesn't log them even to fix errors or check for abuse.`
  : `${PROVIDER} doesn't keep your messages after answering, except it may log them for up to 30 days when it's fixing errors or checking for abuse.`;

/** The short "Where your words go" card on the start screen. */
export const CARD = {
  title: "Where your words go",
  sent: `Your messages in this session, and Pip's notes about them, go to ${PROVIDER}, the company that runs the AI models behind Pip.`,
  notSent: "Your name, email and account aren't sent, and neither are your other sessions.",
  provider: `${RETENTION} It isn't allowed to train AI models on them.`,
  stored: "We save the session on our server so you can come back to it. You can delete it from My sessions at any time.",
  offline: "The offline demo Pip follows a fixed script. Nothing you type leaves our server.",
  aiButton: "Teach AI Pip",
  offlineButton: "Use the offline demo Pip instead",
} as const;

/** One line under the start buttons once the student has seen the full card before. */
export const CARD_SUMMARY = {
  ai: `AI Pip sends your messages in this session to ${PROVIDER}. Not your name or email.`,
  offline: "Last time you used the offline demo Pip: nothing leaves our server.",
} as const;

/** The always-visible line on the teach screen. */
export const SESSION_LINE = {
  ai: `AI Pip: your messages in this session go to ${PROVIDER} to write Pip's replies. Not your name or email.`,
  offline: "Offline demo Pip: nothing you type leaves our server.",
  /** An AI session on a server with no model configured: the script answers and nothing is sent. */
  aiUnavailable: "The AI isn't available right now, so the offline demo Pip is answering. Nothing you type leaves our server.",
} as const;

/** The /ai-data page: the full explanation. Each section is a heading and paragraphs or bullets. */
export const DETAILS: { heading: string; body: string[]; bullets?: string[] }[] = [
  {
    heading: "Your choice",
    body: [
      "Every time you start a session you choose between AI Pip and the offline demo Pip. The choice is saved with the session on our server and can't be changed afterwards, so a session you started offline never sends anything to an AI provider.",
      "The offline demo Pip follows a fixed script of questions and mistakes for each topic. It runs on our server and doesn't read your exact wording.",
    ],
  },
  {
    heading: `What AI Pip sends to ${PROVIDER}`,
    body: [
      `Each time you send a message, our server asks ${PROVIDER} up to three questions: one to write down what you taught (in Pip's words), one to check it against the topic's answer key and pick Pip's next move, and one to write Pip's reply. Together these send:`,
    ],
    bullets: [
      "your newest message and the last few messages of this session (yours and Pip's);",
      "Pip's notes about what you've taught it so far in this session;",
      "the topic's learning goal, answer key and Pip's starting mistakes, which we wrote.",
    ],
  },
  {
    heading: "What we never send",
    body: [
      "Your name, your email address, your account id, your password, and your other sessions. The requests come from our server, so your IP address and browser details aren't sent either. If you type something personal into a message, though, it goes along with that message, so please don't.",
    ],
  },
  {
    heading: `What ${PROVIDER} does with it`,
    body: [
      ZDR_ENABLED
        ? `${PROVIDER} says it doesn't keep customer data from requests like these by default. We've turned on Zero Data Retention in our ${PROVIDER} account, so it also doesn't keep it for system reliability or abuse monitoring.`
        : `${PROVIDER} says it doesn't keep customer data from requests like these by default. It may log what was sent and what came back only while troubleshooting errors that hurt the platform's reliability or investigating suspected abuse, and keeps those logs for up to 30 days unless the law requires longer.`,
      `${PROVIDER}'s agreement doesn't allow it to use what we send, or what its models answer, to train or fine-tune AI models unless we give permission, and we haven't.`,
      `${PROVIDER} says the customer data it keeps is stored in Google Cloud Platform in the United States. It always keeps usage records, such as how many requests we made and how big they were, but not what they said.`,
      `The models are open models (${MODELS.join(" and ")}) that ${PROVIDER} runs itself. ${PROVIDER} may tell a model's developer about how the model is used, but its agreement says that information doesn't include our data.`,
    ],
  },
  {
    heading: "What we keep",
    body: [
      "Our database keeps each session: what you wrote before starting, the conversation, Pip's notes and our checks of what you taught, and your reflection. In the app, only your account can see it.",
      ZDR_ENABLED
        ? "To delete a session, open My sessions and choose Delete on it. That removes it from our database straight away, and it can't be undone."
        : `To delete a session, open My sessions and choose Delete on it. That removes it from our database straight away, and it can't be undone. It can't reach a copy ${PROVIDER} may have logged for troubleshooting or abuse checks; ${PROVIDER} keeps those for up to 30 days (see above).`,
    ],
  },
];
