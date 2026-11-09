# Protégé: Product Overview

*Teachable Agents and the Protégé Effect. Stanford CS193V final project.*

## The problem

Students can read a chapter, nod along in lecture, and still be unable to explain the idea a day later. The feeling of understanding and the ability to explain are different things, and most study tools (including AI tutors) reinforce the first without testing the second. When an AI explains a concept to you, you can follow it without ever producing it yourself.

Our target user is a college student studying for a conceptual course (introductory probability, economics, biology, CS, psychology) who wants to find out whether they actually understand a concept before an exam asks them to.

## Learning by teaching

The protégé effect is the finding that people learn more when they prepare to teach, or actually teach, someone else than when they study for themselves. Teaching forces you to organize what you know, put it into words, notice where the words run out, and respond to someone else's confusion.

Protégé turns that into a product. The student is the teacher. The AI, named Pip, is the learner. Pip asks questions, voices plausible misconceptions, and tries to say ideas back in its own words. The student has to explain, give examples, and correct Pip's mistakes.

## Why the AI is a learner, not a tutor

Three reasons, and they shaped most of the design:

1. **The student does the generating.** With a tutor, the model produces explanations and the student consumes them. With a learner, the student produces every explanation. That is where the cognitive work lives.
2. **Misconceptions become material.** A tutor tries never to be wrong. A learner is useful precisely when it is wrong in realistic ways. Pip's mistake "if two events are independent, doesn't that mean they can't happen at the same time?" is the single most common confusion about that topic, and the student has to dismantle it.
3. **It is honest about what the software can judge.** A tutor implicitly claims to know whether you are right. Our learner never grades the student. The reflection step asks the student to judge themselves, which is both more honest for a prototype and closer to how the protégé effect is thought to work.

## The student journey

1. **Landing.** The pitch, an example exchange with Pip, and a three-step overview. The page makes clear this is not a chatbot: "You explain. Pip gets it wrong. You notice the gaps."
2. **Topic library.** Five topics across five subjects, each with a short description, a learning objective, and a subject accent color. Probability (independence vs. mutual exclusivity) is the featured demo.
3. **Meet your learner.** Pip introduces its specific confusion for the topic. The student sees the objective, three teaching tips, and an optional box to write their current understanding in two or three sentences before teaching. That pre-session explanation is saved for later comparison.
4. **Teaching workspace.** A focused chat. Pip opens with a question. The student types explanations (Enter sends, Shift+Enter adds a line). Pip thinks for a moment, then responds with a follow-up, a misconception, or a check of its own understanding. The sidebar keeps the objective and tips in view. A persistent note says Pip is running on the scripted demo adapter.
5. **End session and reflect.** The student sees what happened (message counts, time, how many misconceptions Pip raised), the concepts and misconceptions Pip's script brought up, and their own pre-session explanation. Then a self-assessment: explain the key concept without notes, rate confidence 1 to 5, name the hardest thing to explain, say whether Pip's mistakes made them doubt their own understanding, and whether teaching exposed a gap.
6. **Past sessions.** A list of in-progress and completed sessions. Each completed session can be reviewed with its full transcript (misconceptions tagged) and the reflection the student wrote.

## UX and visual design decisions

- **Warm, bookish, not corporate.** Ivory background, forest and sage greens, butter yellow for highlights, terracotta for emphasis. Fraunces (a soft serif) for headings and DM Sans for body text. It should feel like a well-designed notebook in a library, aimed at college students rather than children.
- **Pip is a small sprout.** A simple SVG character whose eyebrows and mouth change with mood (curious, confused, thinking, happy). It reads as a learner rather than a generic robot, and the mood changes give the conversation some life without any animation libraries.
- **Notebook details, used sparingly.** Ruled paper appears on the "explain without notes" textarea and the pre-session recap, where writing is the point. The teaching workspace itself is deliberately plain so the conversation stays readable.
- **The student is always labelled the teacher.** Message headers say "You (teacher)". The Meet Pip screen says "You are the teacher here" in a dark green block. The landing badge on the preview says "You are teaching."
- **Observed activity is separated from self-assessment.** The reflection page labels counts as counts ("These are not a score"), tags script content as "From Pip's script", and labels the form "Your self-assessment." We never show a percentage.
- **Demo mode is visible.** The workspace sidebar names the adapter powering Pip. When the real model replaces the script, that label changes automatically.
- **Small, reusable pieces.** Button, Card, Badge, Field, and a tokenized palette in `globals.css` so teammates can add screens without reinventing styles.
- **Accessible by default.** Visible keyboard focus everywhere, labelled form controls, live regions for the chat log and thinking indicator, confirm-before-end, and a layout that works at phone width.

## What is functional vs. mocked

| Area | Status |
| --- | --- |
| All six screens, routing, navigation | Functional |
| Teaching chat (send, thinking state, auto-scroll, retry, refresh persistence) | Functional |
| Pip's responses | **Mocked.** `ScriptedLearnerAdapter` walks a fixed script per topic and does not read the student's wording. Probability has nine turns; other topics have six. |
| Session storage | **Mocked.** `LocalStorageSessionStore` keeps sessions in the browser only. |
| Reflection form and review | Functional (stored with the session) |
| Concepts and misconceptions on the reflection page | Derived from Pip's script tags, so accurate for the demo but not from any analysis of the student's answers |
| Accounts and sign-in | Not built |
| Topic catalogue | Static data in `src/lib/topics.ts` |

## Intended behavior after backend integration

- **AI learner (Chase).** Pip responds to what the student actually said: asks for clarification when an explanation is vague, pushes back when it is wrong, and moves on when it is convincing. The adapter interface already carries the full transcript and the student's latest message. If the model tags each turn with a concept or misconception, the reflection page fills in from real conversation rather than a script.
- **Persistence (Betania).** Sessions, transcripts, pre-session explanations, and reflections are stored server-side so they survive across devices and can be aggregated for evaluation. The `SessionStore` interface is already async, so the swap should not touch the UI.
- **Authentication (Anahi).** Students sign in, sessions belong to a user, and the past-sessions page shows only theirs.

The UI should not need to change for any of these. The seams are `getLearnerAdapter()` and `getSessionStore()`.

## Known limitations

- Pip cannot react to the student. A student who explains something wrong is not corrected, and a student who explains brilliantly gets the same next question. This is the biggest gap and the reason we show the demo-mode note.
- The reflection page lists Pip's scripted misconceptions as "introduced," but has no way to know whether the student corrected them.
- Sessions are lost if the browser's site data is cleared, and are not shared across devices.
- Only five topics exist and they cannot be added from the UI.
- The confidence rating and self-assessment are self-report. They are inputs for our evaluation, not evidence of learning on their own (see `EVALUATION.md`).
- No dark mode. The palette is light-only by design for now.
