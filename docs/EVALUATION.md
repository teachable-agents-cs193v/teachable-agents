# Evaluation Plan

*How we intend to find out whether teaching Pip helps students understand, and how we will avoid fooling ourselves.*

Our professor's warning is the frame for this document: an enjoyable conversation is not evidence that learning happened. Nothing below has been run yet. This is the protocol we plan to use, and the results table at the end is empty on purpose.

## Core hypothesis

Students who explain a concept to a learner that asks questions and voices misconceptions will produce clearer, more complete explanations of that concept afterwards than they could before, and will be better at recognizing the specific misconception when they see it.

A weaker, more honest version we can actually test with a handful of classmates: *after a session, students can identify at least one thing they did not understand as well as they thought.* That "noticing the gap" outcome is what the protégé effect literature suggests happens first, and it is what our reflection form is built to capture.

## What we want students to understand better

For the featured topic, independence vs. mutual exclusivity:

1. Independent events can happen at the same time. Independence is about one event not changing the probability of the other, not about whether they can co-occur.
2. The test for independence is numerical: P(A and B) = P(A) × P(B), or equivalently P(B | A) = P(B). "They feel unrelated" is not the test.
3. Mutually exclusive events (with nonzero probability) are *not* independent. If one happens, the other's probability drops to zero, which is the strongest kind of dependence.

These are the three ideas Pip's script is built around, and they are the misconceptions Pip voices in order.

## User-testing protocol (2 to 3 classmates)

Keep each session to about 20 minutes. One team member runs it, one takes notes.

1. **Setup (2 min).** Explain that they will teach an AI learner about a probability concept, that the AI is scripted and will not understand their exact words, and that nothing is graded. Ask them not to look anything up.
2. **Pre-session explanation (3 min).** Before showing the app, ask the pre-session prompt below out loud or on paper. Record the answer verbatim. (The app also has an optional pre-session box; we ask separately so the answer is not influenced by Pip's intro.)
3. **Teaching session (10 min).** They open the probability topic, read the Meet Pip screen, and teach until Pip says it is ready to wrap up or 10 minutes pass. Observe silently. Note hesitations, places where they rephrase, and any moment they say "wait, actually."
4. **Post-session explanation (3 min).** They fill in the reflection form in the app, including the "explain without notes" box. Record that text.
5. **Debrief (3 min).** Ask the qualitative questions below.

Between participants, clear the browser's site data so each starts with an empty sessions page.

## Explanation prompts

**Pre-session.** "In two or three sentences, explain the difference between independent events and mutually exclusive events as you understand it right now."

**Post-session.** "Without notes, explain how you would check whether two events are independent, and why mutually exclusive events are not independent."

**Follow-up probe (both times).** "A friend says: 'Flipping heads and rolling a six are independent, so they can't both happen on the same turn.' What would you tell them?"

The post-session prompt is deliberately more specific than the pre-session one so we can see whether the numerical test and the exclusive-vs-independent contrast show up unprompted.

## What we assess

- **Explanation quality.** Is the definition correct, and is it stated in terms of probability rather than vibes?
- **Misconception recognition.** When shown the friend's claim, do they identify it as wrong and say why?
- **Conceptual clarity.** Can they give a concrete example and a non-example (a pair that is independent, a pair that is mutually exclusive)?

## Rubric (0 to 2 per criterion)

| Criterion | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Definition of independence | Missing or wrong (e.g. "they can't happen together") | Roughly right in words but no probability statement | States that P(A and B) = P(A)P(B) or that P(B given A) = P(B), in some form |
| Independent vs. mutually exclusive | Treats them as the same, or says exclusive implies independent | Says they are different but cannot explain why | Explains that exclusive events are dependent because one occurring rules the other out |
| Example use | No example, or an incorrect one | One correct example | A correct example *and* a correct non-example, or a worked numerical check |
| Misconception recognition (friend probe) | Agrees with the friend or is unsure | Disagrees but gives a weak or circular reason | Disagrees and names the actual confusion (co-occurrence vs. probability) |

Maximum 8. Score pre and post independently, ideally by two team members without seeing each other's scores, then compare. With 2 or 3 participants we will report the individual scores, not averages.

## Qualitative questions

1. Was there a moment where you realized you were less sure than you thought? What was it?
2. Which of Pip's mistakes was hardest to argue against? Why?
3. Did you say anything to Pip that you now think was wrong or incomplete?
4. Did it bother you that Pip did not respond to your exact words? When did you notice?
5. If you were studying for a midterm on this, would you use this instead of, or in addition to, your usual method?
6. What would have made Pip a better student to teach?

## Engagement vs. evidence of learning

We will treat these as separate columns and report both.

**Engagement signals** (easy to collect, not evidence of learning): messages sent, session length, whether they finished the script, whether they said the session was fun or interesting, confidence rating in the reflection.

**Learning signals** (what we actually care about): change in rubric score from pre to post explanation, correct handling of the friend probe after the session, and a specific, accurate answer to "what did you notice you didn't understand?" A participant who sends twelve messages and rates confidence 5 but whose post explanation still says independent events can't co-occur is an engagement success and a learning failure, and we will say so.

Things we know we cannot claim from this protocol: that the effect would persist a week later, that it beats re-reading the textbook, or that it generalizes beyond probability. If we want to say any of that, we need a comparison condition and a delayed test, which is out of scope for the checkpoint.

## Results table (template)

To be filled in after sessions are run. Leave blank until then.

| Participant | Date | Pre score (/8) | Post score (/8) | Friend probe pre | Friend probe post | Messages sent | Session length | Self-rated confidence | Reported a noticed gap? | Notable quote |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | | | | | | | | | | |
| P2 | | | | | | | | | | |
| P3 | | | | | | | | | | |

Rater agreement on rubric scores (if two raters): ______

Open questions raised by the sessions: ______
