# Teaching Pip (AI learner) user test notes

Chase's notes from a user test of teaching Pip, the AI learner.

* Typing out explanations to Pip felt slow. Teaching by typing every message took a long time
* Pip sometimes didn't follow along with what the tester was teaching, so its replies didn't always match what they had just explained
* It wasn't always clear what the best way to teach Pip was. The tester wasn't sure how to approach explaining the material
* Pip wouldn't try specific problems the tester suggested

## Anahi's notes

Version tested: run locally on Chase's #42 branch at commit `204eebb`, before #42 merged and before Pip v2.

Setup: One classmate tested the AI learner on Chase's #42 branch, running locally. They read the participant notice and used their student account to sign up. The topic they chose was supply and demand.

### Observations

Getting started: The first challenge was picking a topic. They initially chose photosynthesis but switched to supply and demand after realizing they would need to teach the topic to Pip.

Did teaching Pip help them learn? Yes. Pip pushed them to be more specific. For example, it pointed out that saying "amount of demand" was too vague. This brought up the difference between demand and quantity demanded, which is a common misconception in intro economics. The participant also said Pip's questions made them come up with more examples and double-check their understanding.

Did Pip react reasonably? Yes. They felt Pip's responses made sense based on how they explained the topic.

Could they tell what Pip believed? For the most part, yes. They mainly used Pip's facial expressions as feedback, but wanted clearer signals when their explanations were correct.

### Where they got stuck

* They noticed the 15-minute timer in the top right and asked if they were being timed.
* After ending the session, they weren't sure what to do next. They scrolled down to the reflection section and asked whether they were supposed to fill it out.

### Their answers (lightly edited for typos)

**Did explaining it to Pip change how you understand the topic?**

"Yes, because it asked me to provide a lot of examples and be certain of my understanding. It kept asking questions and doubting my responses, which made me doubt myself even when I was sure of my answers. I actually think this was nice, since it really made me understand the material."

**Did Pip do anything that surprised or annoyed you?**

"It was kind of annoying how it kept questioning every single answer, with little feedback that I was telling it something accurate. But its facial expressions were helpful. I used those as feedback."

**Would you use this to study?**

"At some point I did reach a good understanding of supply and demand, so I wish there was more positive feedback when my answers were right. Though I see the tradeoff, because the constant questioning really pushed my learning. It was uncomfortable but effective. I'd use it if I really needed a solid understanding of something, but not for minor concepts."

### Takeaways

1. Pip actually helped the participant learn. Asking them to be more precise brought up a common misconception about demand and quantity demanded. They also said having to explain the topic and give examples helped them understand it better.
2. Pip should give more feedback when it's convinced. The participant got frustrated when Pip kept questioning their answers without acknowledging when they were right. Maybe showing changes in what Pip believes, like the "what Pip believes" panel Mara suggested, could help with this.
3. Give students more direction when choosing a topic. It might help to tell them to pick something they're currently learning or already think they understand.
4. Clarify the timer. The participant wasn't sure if the 15-minute timer meant they were being timed. We should explain what it's for or make it optional.
5. Make the end of the session clearer. The participant wasn't sure what to do after ending the session or whether the reflection was required. We should make the next step more obvious.
6. Probably better for learning something deeply than quick review. The participant said they'd use Pip when they really needed to understand a concept, but probably not for smaller things they just needed to review.

### Issues filed

* [#73](https://github.com/teachable-agents-cs193v/teachable-agents/issues/73) Pip never signals when it's convinced (takeaway 2)
* [#74](https://github.com/teachable-agents-cs193v/teachable-agents/issues/74) Topic picker: guide students to pick a topic they're learning or think they understand (takeaway 3)
* [#75](https://github.com/teachable-agents-cs193v/teachable-agents/issues/75) The timer made the tester think they were being timed (takeaway 4)
* [#76](https://github.com/teachable-agents-cs193v/teachable-agents/issues/76) After ending a session, the next step is unclear: make the reflection visible and say whether it's required (takeaway 5)
