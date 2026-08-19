# Findings

Each entry maps to one commit (commit messages carry the entry id). Ids follow `PLAN.md`.

## BLOCKER-0 — Pinned model ids don't exist in the AI Gateway catalog

**What we found.** `agent/agent.ts` pinned `anthropic/claude-opus-4-1-20250805` and
`evals/evals.config.ts` pinned `anthropic/claude-haiku-4-5` for the eval judge. Neither id
exists in the Vercel AI Gateway catalog: the Gateway only lists undated ids, no
`claude-opus-4.1` variant is in the catalog at all, and the haiku id uses a dash where the
catalog uses a dot (`claude-haiku-4.5`). The comment in `agent.ts` even acknowledged dated
ids aren't in the catalog — it worked around the *diagnostic* (by pinning
`modelContextWindowTokens`) instead of the actual problem. As shipped, every review fails
with `MODEL_CALL_FAILED Model 'anthropic/claude-opus-4-1-20250805' not found`; nothing else
in the project can even be assessed until this is fixed.

**How we confirmed it.**
- Reproduced: `POST /eve/v1/review` with `fixtures/valid.json` → 502
  `MODEL_CALL_FAILED Model 'anthropic/claude-opus-4-1-20250805' not found`.
- Queried the live catalog (`GET https://ai-gateway.vercel.sh/v1/models` with a real key):
  the Anthropic entries are undated (`claude-sonnet-4.5`, `claude-haiku-4.5`, `claude-opus-4`,
  `claude-opus-4.5`…); no dated ids, no `4.1`.
- After the fix, the same request no longer fails with "model not found" — the error moved to
  a Gateway account-tier restriction (`Free tier users do not have access to this model`),
  which is an account/billing state on our side, not a code problem. A control call with the
  free-tier-eligible `anthropic/claude-3-haiku` through the same key succeeded, isolating the
  remaining failure to the account tier rather than the code path.

**What we changed and why.**
- `agent/agent.ts`: model → `anthropic/claude-sonnet-4.5`. A catalog-valid id, and
  deliberately *not* an Opus-class model: this is a short, tool-assisted classification task,
  and model cost is an explicit design constraint of this challenge (see PLAN.md P2-7 — this
  fix and the cost fix are the same change; quality will be proven by the eval suite once it
  runs).
- `agent/agent.ts`: removed `modelContextWindowTokens: 200_000` and its comment — the pin
  existed only to mute the catalog-lookup diagnostic for the dated id; with a catalog-valid
  id the window resolves from the catalog.
- `evals/evals.config.ts`: judge → `anthropic/claude-haiku-4.5` (the catalog spelling).

**Verification status.** Verified end-to-end. After the fix (and after resolving a Gateway
account-tier issue on our side — the key's team needed paid credits), `POST /eve/v1/review`
with `fixtures/valid.json` completed a full agent turn on `claude-sonnet-4.5` and returned a
correct structured decision: `approve`, citing `[MEAL-01] $50 per attendee limit` at
$48/attendee. The eval suite was deliberately not run yet — proving the project runs only
needs one review turn; evals come with the baseline pass (Step 1).

## Noticed but deliberately not fixed (running list)

- Nothing deliberately skipped yet — see `PLAN.md` for the full backlog being worked in order.
