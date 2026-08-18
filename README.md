# Expense Guard — AI Engineer Challenge

## What this is

Expense Guard is a small AI agent, built on [Eve](https://github.com/vercel/eve) (Vercel's agent
framework), that reviews expense submissions for a multi-company (multi-tenant) platform. Each
review gets a `company_id`, a raw OCR'd receipt, a claimed amount, and a category. The agent looks
up that company's own written expense policy, sanity-checks the submission, and returns one
structured decision: `approve`, `flag_for_review`, or `reject`, with a cited policy rule and a
reason.

This is a real, runnable slice of the stack we actually build on: TypeScript, an agent SDK, tool
calls, structured output, and evals as executable specs — not a toy or a trivia quiz.

## The task

This agent has problems. Some are correctness bugs, some are security issues, some are cost
problems, some are just code that's harder to maintain than it needs to be. We're not telling you
what or where — finding them is the point.

Your job:

1. **Find the problems.** Read the code, run the agent, poke at it with the existing fixtures and
   your own. Form hypotheses and check them.
2. **Fix them.** Ship production-quality changes — not the minimum diff to make a demo look good.
3. **Prove your fixes hold.** Write evals. An eval that would have caught the bug you fixed is
   worth more to us than a fix with no eval behind it.
4. **Leave the code better than you found it.** If you touch a piece of code that's badly
   structured, clean it up as part of your change. We're not asking for a rewrite of the whole
   repo — just don't leave a mess you walked past.

We care about *how* you evaluate, reason, and make tradeoffs — not about how much ground you
cover or how fast you move. A small number of well-diagnosed, well-tested fixes beats a large
number of shallow ones.

## Setup

```bash
bun install
cp .env.example .env
# fill in AI_GATEWAY_API_KEY in .env — a Vercel AI Gateway key that can reach the
# anthropic/* models referenced in agent/agent.ts and evals/evals.config.ts

bunx eve build     # build the agent
bunx eve dev       # run it locally (HTTP channel: POST /eve/v1/review)
bunx eve eval      # run the eval suite (evals/*.eval.ts)
```

`fixtures/*.json` are sample submissions — pass one via the `POC_REQUEST_FILE` env var (see
`.env.example`) to drive `eve dev` / `eve eval` against a specific case, or POST your own JSON body
to `/eve/v1/review` once `eve dev` is running.

**macOS note:** the sandbox backend is pinned to `justbash` (`agent/sandbox.ts`) — Eve's default
backend probe hangs forever on macOS trying to prewarm a VM backend that isn't installed. This is
already handled for you; you shouldn't need to touch it.

## Ground rules

- Use any coding assistant you want — Claude Code, Cursor, Copilot, raw ChatGPT, whatever you
  normally reach for. This challenge assumes you use AI to work; we want to see how you direct it,
  not whether you avoid it.
- We expect production-quality code: clear naming, no dead code, no magic numbers you didn't
  explain, tests that actually assert something.
- Don't fabricate data — evals, findings, and metrics should reflect what you actually ran and
  observed, not what you assume should be true.
- This is a multi-company platform. Respect company (tenant) isolation — a review for one company
  should never be able to see or leak another company's policy or data.
- Be mindful of cost. Model choice and prompt structure have real, large cost implications in
  production agent systems — treat them as a design constraint, not an afterthought.

## AI judgment — written section

Beyond fixing the code, we want your judgment on **when an agent is the right tool at all**.
Answer in a `BOUNDARIES.md` at the repo root, in two parts. Short, concrete answers beat general
essays — bullet points are fine.

### Part A — Boundaries of this agent

1. **Model vs. code.** Which responsibilities currently handled by (or exposed to) the LLM in
   Expense Guard should be deterministic code instead, and why? Which genuinely need a model?
2. **Guarantees.** What can this agent never guarantee, no matter how good the prompt is? For
   each item: where must that guarantee be enforced instead?
3. **Failure containment.** When the model gets it wrong anyway — hallucinated rule, wrong
   decision — what should the surrounding system do so that a wrong LLM output cannot become a
   wrong business outcome?

### Part B — Build the right thing

For each scenario below, recommend the **shape** of the solution — no AI at all, deterministic
automation, a single LLM call, retrieval + LLM, or a full tool-using agent — and justify it in
2-4 bullets. Also state **what would change your mind** (the condition under which you'd pick a
different shape). There is no trick: some of these should not be agents, and recommending an
agent everywhere is a wrong answer.

1. **Invoice reconciliation.** Every night, compare the payment provider's invoices against the
   internal billing records and alert the team about mismatches.
2. **Message intent tagging.** Tag every inbound customer WhatsApp message (~500k/day) with an
   intent label (`pricing_question`, `support_request`, `purchase_intent`, ...) to drive routing
   and analytics.
3. **Policy Q&A for finance teams.** Let a company's employees ask free-form questions about
   their own expense policy ("can I expense a hotel upgrade?") and get an answer grounded in the
   policy text.
4. **Autonomous expense appeals.** When an expense is rejected, let the submitter dispute it;
   the system re-examines the receipt, may request missing documents from the submitter, checks
   the policy, and either reverses the decision or escalates to a human with a recommendation.

## Deliverables

1. **A PR or diff** against this repo with your changes.
2. **`FINDINGS.md`** — short and direct. For each thing you addressed: what you found, how you
   confirmed it was real, what you changed, and why. Also list anything you noticed but
   deliberately chose *not* to fix, and why you deprioritized it. We want your reasoning, not a
   changelog.
3. **`BOUNDARIES.md`** — your answers to the AI-judgment section above (Parts A and B).
4. **Your coding-assistant session export**, zipped, as a JSONL (or your tool's native export
   format if JSONL isn't available). We want to see your actual working process — prompts,
   iterations, dead ends included.

## Time box

Plan for about **3 hours**, worked async on your own time — leave roughly 30-40 minutes of that
for `BOUNDARIES.md`. Afterward, we'll do a **~1 hour live session** together to walk through your
diagnosis, your evals, your AI-judgment answers, and your decisions — including questions on
parts of the system you may not have touched.

There's no bonus for speed and no penalty for using the full time thoughtfully. If 3 hours run out
before you're done, ship what you have and be upfront in `FINDINGS.md` about what's left and why
you prioritized what you did.
