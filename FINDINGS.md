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

## BLOCKER-1 — Authored channel shadowed eve's default channel, killing the eval suite

**What we found.** `agent/channels/eve.ts` used the reserved `eve` file stem, which
*replaces* the framework's default HTTP channel instead of adding to it. The default channel
carries the `/eve/v1/session*` routes that `eve eval`, the `eve dev` playground, and SDK
clients all drive the agent through. With it gone, every eval failed instantly with
`404 Cannot find any route matching [POST] .../eve/v1/session` — before any model call — so
the repo's "evals as executable specs" could never have run. The dev playground failed with
the same 404 at startup.

**How we confirmed it.** Baseline `bunx eve eval`: `Results: 2 failed (2 total)` in 128ms,
both with the session-route 404. Eve's own docs (`docs/channels/eve.mdx`): the default
session routes "are enabled by default even when `agent/channels/eve.ts` does not exist" —
that file exists only to *override* them; and the channel file stem is the channel id.

**What we changed and why.** Renamed `agent/channels/eve.ts` → `agent/channels/review.ts`
(content unchanged apart from a comment documenting the naming constraint). As `review`, the
channel adds `POST /eve/v1/review` alongside the restored default routes instead of replacing
them. Verified after the change: `POST /eve/v1/session` answers 400 on a bad body (route
exists; was 404), `/eve/v1/review` still serves full reviews, and `bunx eve eval` runs for
real: `Results: 2 passed (2 total)`, judge score 100%. The restored default routes use eve's
default auth chain (`localDev` + Vercel OIDC), same as the scaffold default.

## Baseline (Step 1) — what we actually observed before fixing anything

All live runs on `claude-sonnet-4.5` via `POST /eve/v1/review`, 2026-08-18.

- **Happy path works.** `request.json` (acme meal, $96, 2 attendees) → `approve` citing
  MEAL-01 at $48/attendee. `ambiguous.json` (acme SaaS $450/mo) → `flag_for_review` citing
  SW-01, consistent across 3 runs. `illegible.json` (globex travel, smudged totals) →
  `flag_for_review`, correctly noting the $45-line-items-vs-$1,280-claim mismatch and citing
  globex's TRVL-01.
- **P0-1 cross-tenant leak: CONFIRMED, two ways.** (a) Deterministically, no model: a bun
  script importing `searchPolicy` gets "Acme Robotics" for `initech` and `globex` after one
  `acme` call — the module-level memo returns the first company forever. (b) Live: after acme
  reviews, `cross-company.json` (initech) came back citing *acme's* rule text ("up to $50 per
  attendee; itemized receipt") instead of initech's $25 rule. The decision (`approve`)
  coincidentally matches either policy — the leak is invisible unless you read the citation.
- **P0-2 unknown-company fallback: CONFIRMED** deterministically: in a fresh process,
  `searchPolicy("no-such-co")` returns "Acme Robotics" (the `?? POLICIES.acme` fallback).
- **NEW BLOCKER (P0-class): the eval suite cannot run at all.** `bunx eve eval` → both evals
  fail in ~130ms with `404 ... [POST] /eve/v1/session`, before any model call. The eval
  harness (and the `eve dev` playground) drive the agent through eve's default session
  routes; the authored channel `agent/channels/eve.ts` replaces the default channel and only
  registers `/eve/v1/review`. Added to PLAN.md as BLOCKER-1.
- **Hypothesis DISPROVEN (P1-4, retracted).** We initially believed `approve-valid.eval.ts`
  asserted the wrong outcome. Wrong: our first fixture read came from `cat fixtures/*.json`
  (alphabetical order) and we misattributed contents to filenames. `request.json` is the $96
  within-policy meal; the eval's `approve` expectation is correct. Cost us one confused
  debugging detour ("the server ignores my POST body") before per-file reads disproved it.
  The real fixture issue is that `request.json` and `valid.json` are byte-identical
  duplicates.
- **PII note:** in the baseline runs the model did not quote the receipt's full card number
  in `reason`, but nothing prevents it (the rubric explicitly asks to quote receipt details).
  Still queued as hardening (P3-9).

## Noticed but deliberately not fixed (running list)

- Nothing deliberately skipped yet — see `PLAN.md` for the full backlog being worked in order.
