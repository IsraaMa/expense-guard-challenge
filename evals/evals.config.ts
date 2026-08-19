// Run-wide eval configuration for Expense Guard. `eve eval` boots one agent process that
// reads its submission from a single fixture (POC_REQUEST_FILE, default
// fixtures/request.json). The judge model scores t.judge.* assertions only; it never runs
// the agent under test.
import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  judge: {
    model: "anthropic/claude-haiku-4.5",
  },
  maxConcurrency: 2,
  timeoutMs: 120_000,
});
