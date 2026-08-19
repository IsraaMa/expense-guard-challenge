# Expense Guard — Diagnosis & Fix Plan

This is an executable spec. Every item states its status, the exact files involved, what to
change, and how to verify. An engineer (or model) picking this up should be able to perform
any remaining item to production quality without re-deriving context. Completed items carry
their commit subject so they are not redone.

## Environment facts (read first)

- Runtime is **bun**; it lives at `~/.bun/bin/bun` and may not be on PATH in fresh shells
  (`export PATH="$HOME/.bun/bin:$PATH"`).
- Commands: `bunx eve build` (compile), `bunx eve dev` (serve on `http://127.0.0.1:2000`),
  `bunx eve eval` (eval suite), `bun test` (unit tests), `bunx tsc --noEmit` (typecheck).
- Only ONE eve dev server can run per repo. `eve eval` refuses to start while `eve dev`
  runs. Before `eve eval`, kill the dev server:
  `PID=$(lsof -nP -tiTCP:2000 -sTCP:LISTEN); [ -n "$PID" ] && kill $PID`.
- If any request returns `{"error":"Dev server is unavailable."}`, the dev worker crashed
  (often after a hot reload); restart `eve dev`.
- Model access needs `AI_GATEWAY_API_KEY` in `.env` (a Vercel AI Gateway key on a paid-tier
  team). Gateway model ids are undated (`anthropic/claude-sonnet-4.5`, `claude-haiku-4.5`).
- Remotes: `origin` = Leadsales upstream (**no push access**); `fork` =
  https://github.com/IsraaMa/expense-guard-challenge (push here). Work happens on branch
  `fixes`.

## Working rules (process, applies to every fix)

- **FINDINGS.md is maintained as we go, not written at the end.** Each entry records: what
  we found, how we confirmed it was real (actual commands/output observed), what we changed
  and why, and how the fix is proven. Disproven hypotheses stay in, marked as retracted.
  Anything noticed but deliberately not fixed goes in the final section with the reason.
- **One finding = one commit**, in fix order; the commit subject carries the finding id.
  No drive-by changes in a commit that belong to a different finding.
- **Commit descriptions are business-level.** Lead with who was affected and a concrete
  example; implementation mechanics live in FINDINGS.md and the diff. Say "an Initech meal
  was approved citing Acme's $50 limit" rather than "remove module-level memoization".
- **After every commit, push** (`git push` — branch `fixes` tracks `fork/fixes`).
- **Per-commit verification checklist** (all must pass before committing):
  1. `bunx tsc --noEmit` — clean.
  2. `bun test` — all unit tests pass.
  3. `bunx eve build` — builds.
  4. `bunx eve eval` (dev server stopped first) — all evals pass, no gate failures.
  5. Anything the fix claims about live behavior was actually observed (curl the endpoint,
     read the logs) — never asserted from assumption.

## Findings and fixes

### BLOCKER-0 — Model ids didn't exist in the Gateway catalog — ✅ DONE

Commits: "BLOCKER-0: restore service by fixing unavailable AI model references" +
"BLOCKER-0: confirm expense reviews work end-to-end again".
`agent/agent.ts` now pins `anthropic/claude-sonnet-4.5` (also the P2-7 cost choice);
`evals/evals.config.ts` judge is `anthropic/claude-haiku-4.5`. Verified end-to-end.

### BLOCKER-1 — Authored channel shadowed eve's default channel; eval suite couldn't run — ✅ DONE

Commit: "BLOCKER-1: restore the automated quality gate (eval suite runs again)".
The custom channel moved from `agent/channels/eve.ts` (reserved stem = replaces the default
channel and its `/eve/v1/session*` routes) to `agent/channels/review.ts`. Do not rename it
back. The current `agent/channels/eve.ts` is a legitimate `eveChannel()` override that
KEEPS the default routes (see P2-8); only a `defineChannel()` under that stem is the bug.

### P0-1 / P0-2 — Cross-tenant policy leak (memoization + acme fallback) — ✅ DONE

Commit: "P0-1/P0-2: stop one company's expense policy from deciding another company's
expenses". `agent/lib/policy-store.ts` has no cache and throws on unknown companies.
Guarded by `agent/lib/policy-store.test.ts` (4 tests that fail against the old code).

### P0-3 — Model-supplied company_id let a receipt choose the policy — ✅ DONE

Commit: "P0-3: a receipt can no longer choose which company's policy applies".
`search_policy` resolves the company from `submissionState`; input schema has only `topic`.
Guarded by `evals/tenant-isolation.eval.ts` and `evals/receipt-injection.eval.ts`, which
POST real submissions through `evals/review-endpoint.ts` (shared helper).

### P1-4 — "approve-valid eval asserts wrong outcome" — ❌ RETRACTED (not a bug)

`fixtures/request.json` is a within-policy $96 meal; the eval is correct. The suspicion
came from misreading `cat fixtures/*.json` output (alphabetical order). Kept for honesty.

### P1-5 — `request.json` and `valid.json` were byte-identical duplicates — ✅ DONE

Commit: "P1-5: remove the duplicate sample fixture that caused a real misdiagnosis".
`fixtures/valid.json` deleted; `request.json` (the `POC_REQUEST_FILE` default) stays;
QUICKSTART references updated. Evals unaffected.

### P1-6 — validate_expense validated nothing — ✅ DONE

Commit: "P1-6: catch inflated claims the itemization does not support". Pure logic in
`agent/lib/validate-submission.ts` (+5 unit tests); the tool takes no arguments and reads
`submissionState`. Guarded end-to-end by `evals/unsupported-amount.eval.ts`.

### P2-7 — Opus-class model for a classification task — ✅ DONE (with BLOCKER-0)

`claude-sonnet-4.5` at roughly 1/5 the price; suite quality verified by the evals
(5/5, 10/10 gates). Revisit only if evals start failing on model quality.

### P2-8 — Volatile data in the system prompt — ✅ DONE (honest negative on cost)

Commit: "P2-8: keep per-request data out of the reusable system prompt". Static system
prompt (`buildSystemPrompt()`), submission delivered as a user-role context message by both
channels (`review.ts` send payload; `eve.ts` `onMessage` for eval/playground). Measured
result: cross-request `cacheReadTokens` stayed 0 — eve 0.11 puts its cache breakpoint at
the message tail, so the win is structural, not monetary, until the framework caches the
static prefix. Numbers in FINDINGS.md. Do not claim cost savings for this change.

### P3-9 — Untrusted receipt text is undelimited; card PANs flow to the model unredacted — ✅ DONE

Commit: "P3-9: card numbers never reach the AI or the decision record". `agent/lib/redact.ts`
masks PANs before prompt build; the receipt is fenced in `<receipt_ocr>` tags with the trust
boundary stated in the static instructions. Guarded by `redact.test.ts` (5 tests) and the
deterministic `evals/pan-redaction.eval.ts`. The receipt-injection eval assertion was also
hardened against false positives (details in FINDINGS.md).
### P3-10 — Dead code / C-style noise sweep — ◐ MOSTLY DONE, final sweep TODO

Already cleaned in their own commits: `policy-store.ts`, `validate_expense.ts`,
`build-instructions.ts`. **Remaining spec:** `grep -rn "// const\|//   \|oldRender\|hits2"
agent/ evals/` and read `agent/lib/request-context.ts` + `agent/channels/review.ts` once
more; remove anything commented-out or unused that remains. If nothing is found, close the
item in FINDINGS ("final sweep found nothing") without an empty commit. Do not reformat
untouched files.

### FINAL — Deliverables pass — ⬜ TODO (last)

1. FINDINGS.md review: every commit has an entry; add the "deliberately not fixed" section
   with at least: (a) eve's message-tail cache breakpoint (upstream framework behavior;
   documented, not patchable in app code), (b) `auth: null` on `POST /eve/v1/review`
   (acceptable for the exercise's local scope; a production deployment must put route auth
   in front — note it, don't build auth), (c) currency is echoed but never converted or
   validated against policy currency (needs a product decision on conversion), (d) attendee
   count is inferred from receipt text (e.g. "x2") — a submission field would be the real
   fix. Reference PLAN.md statuses.
2. README claims stay true (routes, commands). QUICKSTART.md stays accurate.
3. Squash nothing; the ordered commit history is part of the deliverable. Final
   `git push`, then prepare the PR `IsraaMa:fixes` → upstream (or hand over the diff), and
   export the assistant session as the third deliverable.
