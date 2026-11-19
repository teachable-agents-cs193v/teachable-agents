# AI Evals

## The AI systems we evaluate

The AI systems we evaluate are the note-taker, the assessor, and Pip.
- The note-taker fills Pip's notebook with the student's ideas.
- The assessor assesses whether the student's ideas are correct.
- Pip is the actual chatbot.

## Why did you choose these behaviors to measure?

We picked these behaviors because we have to make sure our model doesn't output anything unexpected. Basically, we chose each behavior because we don't want the model to output things that don't fit its character. If it's pretending to be a student who doesn't know something, it shouldn't output information it's pretending not to know. We also have to make sure it makes mistakes the way a student would, and that it won't be swayed by user input.

The assessor needs its own checks because we need to make sure our single source of truth for grading is accurate. It would be very bad if we labeled the user's input as a misconception when it really isn't, or if we couldn't properly evaluate what Pip is outputting.

## How did you come up with your sample inputs?

We came up with sample inputs that test both regular conversation and edge cases: prompt injection, garbled text, and trying to convince the agent to do things it isn't allowed to do. We also made sure that for regular text, the model's output is aligned with the student's input.

## How did you evaluate the outputs?

We used Claude as the judge because we can leverage frontier intelligence to make really accurate assessments for this product case. We also used Claude as frontier intelligence to check whether our research model is accurate, which it can definitely do for simple things like derivatives.

We use code checks and sympy to give numerical evaluation, so that part is deterministic. We run the evals more than once to make sure our variance isn't huge and that we get consistent results for our models.

## What were the original evaluation results?

Originally, we used a different model, and its output got more garbled the more you tried to ask it and teach it things. That was really bad, even though it did completely forget calculus. That's what made us switch back to this kind of model, one that pretends not to know something.

On the first run of our eval sets, the core worked: the assessor passed 85% of its cases and almost never wrongly changed Pip's mind (0.6% false flips), and in conversation Pip leaked nothing (0%) and followed taught rules exactly (100%). The weak spots were that the assessor missed about 1 in 4 explanations, and missed some wrong teaching, like "the derivative of x^5 is 5x".

## What changes did you make in response to the evaluation results?

Switching from the unlearned model to a model that pretends not to know was the first change. In response to the results, we also changed things like Pip voicing its own misconceptions, to fit the newer model.

## How did you decide that what you have is "good enough"?

There are some things that absolutely can't be compromised on, like prompt injection: security concerns should be really low. For things that only mildly affect the user experience, benchmarks around 90% are probably pretty good, especially with this open-weight model, since we're not using very strong intelligence for this.
