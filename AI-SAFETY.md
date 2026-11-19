# AI Safety

## Every place we use an LLM

We use an LLM in three places: the note-taker, the assessor, and Pip.
- The note-taker fills Pip's notebook with the student's ideas.
- The assessor assesses whether the student's ideas are correct.
- Pip is the actual chatbot.

## For each use: why it doesn't have all three parts of the lethal trifecta

Each call is safe because it either has no data it can leverage to make harmful decisions, or no way to send anything out.

### Use 1: the note-taker

The note-taker is safe because it can never see the answer key.

### Use 2: the assessor

The assessor can't send text out. It only outputs fixed IDs and values.

### Use 3: the reply

The reply only uses Pip's notebook.

## The software controls that enforce this

The software we use to enforce this:
- **Separation of powers between the models.** The note-taker's and Pip's prompts are built in code only from Pip's notebook, so they're never given the answer key. The assessor's output goes through an allowlist in code (`assessorBoundary.ts`). It keeps only known concept, misconception and belief IDs, a fixed list of moves, and true/false values, and drops anything else, so it can't pass text along.
- **Tags around the student's text** (`<student_message>`, with any fake closing tags stripped) and a 1,500-character limit.
- **Pip's replies are shown as plain text,** with no links or images that could carry data out.
- **Tests that attack each boundary,** including a fake assessor that stuffs the answer key into every field: it never reaches Pip's prompt, the student's screen, or the database.

## What's left, and what we accept

We don't have very good rate limiting yet.
