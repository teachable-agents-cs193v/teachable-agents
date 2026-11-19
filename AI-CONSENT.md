# AI Consent

<!--
HOW TO USE THIS FILE
- Write every answer yourself, by hand (course requirement).
- The hidden notes are technical facts only, verified on 2026-11-19.
- DELETE every comment before you submit.
-->

## Which third-party AI services receive user data

<!--
FACTS
- Provider: Groq (GroqCloud API). Models: openai/gpt-oss-20b (note-taker, reply) and openai/gpt-oss-120b (assessor). These are open models served by Groq.
- What's sent, per student message:
  - the student's message
  - recent conversation in that session
  - Pip's notes about the session
  - the topic's learning goal and, for the assessor only, the answer key
- Not sent: the student's name, email or account id; other sessions.
  - The consent build is verifying this for every prompt; see its report.
- Eval runs send scripted (made-up) students only, plus 5 real sessions by a team member, with identities removed.
-->


## What we found in their data policies

<!--
FACTS (quotes; pages fetched 2026-11-19)
Sources:
- https://console.groq.com/docs/your-data (no date shown)
- https://groq.com/privacy-policy (effective November 12, 2025)
- https://console.groq.com/docs/legal/services-agreement (last modified June 22, 2026)

Retention:
- "By default, Groq does not retain customer data for inference requests."
- It "may temporarily log inputs and outputs only when: troubleshooting errors that degrade platform reliability, or investigating suspected abuse."
- These logs are kept "up to 30 days, unless legally required to retain longer."
- Usage metadata is "always retained" and "does not contain customer inputs or outputs."

Zero Data Retention:
- "All customers may enable Zero Data Retention (ZDR) in Data Controls settings. When ZDR is enabled, Groq will not retain customer data for system reliability and abuse monitoring."
- The services agreement §4.2 says "Eligible Customers" instead. Check what the account's Data Controls page allows.
- Not enabled yet. Only the account owner can turn it on in the Groq console. After turning it on, set ZDR_ENABLED in the app's provider-copy module (consent branch) so the notice matches.

Training (services agreement §4.2):
- "Groq is not permitted to use Inputs or Outputs for training or fine-tuning any AI Model Services or other models, unless explicitly granted permission or instructed by Customer."

Location:
- "All customer data is retained in Google Cloud Platform (GCP) buckets located in the United States."

Model makers (§4.1):
- Groq "may share information, that does not include Customer Data, about your use of" a third-party model with its developer.
- The pages don't say whether OpenAI receives anything for gpt-oss.

Other:
- The agreement says the services "are not for consumer use."
- No free-versus-paid difference shown on the your-data page.

Our own storage:
- Sessions (messages, Pip's notebook) are stored in our Postgres database.
- Students can delete a session from their dashboard.
- Encryption at rest is in PR #50 (Betania).
-->


## How we present this to users

<!--
FACTS: being built tonight on branch learner/ai-consent
- A "where your words go" card before each session.
- A choice between "Teach AI Pip" and an offline demo Pip that sends nothing to any AI provider. The server enforces the choice.
- A full-details page with links to Groq's policies.
- A line in the teach screen saying where messages go.
- Clear delete copy.
(Fill in from the finished build.)
-->


## Why we chose this way of informing users

<!-- (Your reasoning.) -->

