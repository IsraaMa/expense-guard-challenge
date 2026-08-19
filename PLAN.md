# Expense Guard — Diagnosis & Fix Plan

Status: **plan only — no code changed yet.** This documents the problems found by reading the
code and the ordered plan to fix them.

## Working rules (process, applies to every fix)

- **FINDINGS.md is maintained as we go, not written at the end.** It is created with the
  first fix. For each thing addressed it records: what we found, how we confirmed it was real
  (the actual command/eval/output observed), what we changed, and why. It also lists anything
  noticed but deliberately not fixed, with the reason it was deprioritized. Reasoning, not a
  changelog.
- **One finding = one commit**, in fix order. Every commit maps to a FINDINGS.md entry so any
  change can be traced back to its diagnosis. Commit messages name the finding they resolve
  (e.g. `P0-1: remove cross-tenant policy memoization`).
- No drive-by changes inside a commit that belong to a different finding.

## Problems identified (by severity)

### BLOCKER — the project does not run at all

0. **Model ids don't exist in the AI Gateway catalog** — `agent/agent.ts:13`,
   `evals/evals.config.ts:10`
   The agent pins `anthropic/claude-opus-4-1-20250805`; the Gateway only accepts undated ids,
   and no `claude-opus-4.1` variant is in the catalog at all (confirmed by querying
   `https://ai-gateway.vercel.sh/v1/models` with a live key — every `/eve/v1/review` call
   fails with `MODEL_CALL_FAILED Model ... not found`). The eval judge id
   `anthropic/claude-haiku-4-5` is also wrong (catalog id is `claude-haiku-4.5`, dot not
   dash), so `eve eval` fails the same way. Nothing downstream can be assessed or evaluated
   until these resolve; this is Step 0 of the fix plan and folds into the cost fix (P2-7):
   proposed replacement is `anthropic/claude-sonnet-4.5` for the agent and
   `anthropic/claude-haiku-4.5` for the judge.

### P0 — Tenant isolation (security)

1. **Policy memoization leaks across tenants** — `agent/lib/policy-store.ts:5-13`
   Module-level `activePolicy` caches the *first* company's policy for the process lifetime.
   Every subsequent review — for any company — is judged against that first company's policy.
   Direct cross-tenant data leak plus wrong decisions.
2. **Unknown company silently falls back to acme** — `agent/lib/policy-store.ts:9`
   `POLICIES[companyId] ?? POLICIES.acme` means a typo'd or unknown `company_id` gets judged
   against (and shown) Acme's policy instead of failing. Another tenant leak.
3. **Tools trust model-provided `company_id`** — `agent/tools/search_policy.ts`,
   `agent/tools/validate_expense.ts`
   The model supplies `company_id` as a tool argument. A prompt-injected receipt can steer the
   model into fetching another company's policy. `submissionState`
   (`agent/lib/request-context.ts:72`) exists to be the authoritative source — the tools
   ignore it.

### P1 — Correctness

4. **Reference eval asserts the wrong outcome** — `evals/approve-valid.eval.ts`
   It expects `approve` on the default fixture (`fixtures/request.json` = acme, software,
   **$450/month**), but acme rule SW-01 says >$200/month → `flag_for_review`. Either the
   assertion or the fixture is wrong (`fixtures/valid.json` is the within-policy meal the eval
   describes).
5. **`cross-company.json` is a duplicate** — byte-identical to `valid.json`; tests nothing
   cross-company.
6. **`validate_expense` validates nothing useful** — only checks field presence, which the
   input schema already guarantees. It never checks line-item sums vs the claimed amount,
   though the system prompt tells the model to verify totals.

### P2 — Cost

7. **Opus for a small classification task** — `agent/agent.ts:13` pins
   `claude-opus-4-1`. Sonnet (or Haiku) is drastically cheaper and sufficient; provable via
   evals.
8. **Prompt ordering defeats caching** — `agent/lib/build-instructions.ts:62-71` puts the
   volatile submission block *before* the static instructions, so no stable prefix can be
   cached. Static-first, volatile-last.

### P3 — Security hardening / code quality

9. **Prompt injection + PII surface** — raw receipt OCR text is interpolated into the system
   prompt with no delimiting, and the rubric asks the model to "quote receipt details" while
   fixtures contain full card PANs. Delimit receipt as untrusted data; redact card numbers.
10. **Dead/junk code** — commented-out blocks (`oldRender`, `hits2`, the `big` check),
    `doIt`'s unused `tmp` / `_label` / `_status`, `2 - missing.length * 1`, C-style string
    concatenation throughout `build-instructions.ts` and `policy-store.ts`.

## Fix plan (in order)

0. **Unblock the project** — fix anything that prevents it from running at all: replace the
   nonexistent model ids in `agent/agent.ts` and `evals/evals.config.ts` with catalog-valid
   ones (see BLOCKER-0), and verify a review request and the eval suite actually execute
   end-to-end. First commit, first FINDINGS.md entry.
1. **Baseline** — `bun install`, build, run the agent against the existing fixtures to confirm
   hypotheses empirically (especially the memoization leak via two sequential requests for
   different companies, and the true expected decision for `request.json`).
2. **Fix tenant isolation** — remove the memoization; throw on unknown `company_id`; make the
   tools read `company_id` from `submissionState` and drop it from tool input schemas so the
   model can't spoof it.
3. **Fix the broken eval + fixtures** — align `approve-valid` with a genuinely within-policy
   fixture; make `cross-company.json` a real cross-tenant case; add a flag-for-review
   expectation for `request.json`.
4. **Make `validate_expense` real** — read the submission from state; check line-item sum vs
   claimed amount; surface mismatch/illegibility.
5. **Cost** — switch the model to Sonnet; reorder the prompt static-first for caching; verify
   quality holds by re-running the eval suite.
6. **Harden the prompt** — delimit receipt OCR as untrusted data; redact card PANs before they
   reach the prompt/output.
7. **Cleanup** — rewrite `build-instructions.ts`, `policy-store.ts`, `validate_expense.ts`
   idiomatically; delete dead code.
8. **Evals (the proof)** — unknown-company failure, sequential cross-tenant isolation,
   over-limit → flag, line-item/amount mismatch, prompt-injection-in-receipt resistance,
   PAN-not-leaked-in-reason.
9. **FINDINGS.md final pass** — the file is written incrementally with each commit (see
   Working rules); this step is only a review: confirm every commit has its entry, and the
   deliberately-not-fixed list is complete with reasoning.
