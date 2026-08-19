// Run-wide eval configuration for Expense Guard. `eve eval` boots one agent process that
// reads its submission from a single fixture (POC_REQUEST_FILE, default
// fixtures/request.json). The judge model scores t.judge.* assertions only; it never runs
// the agent under test.
import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  judge: {
    model: "anthropic/claude-haiku-4.5",
  },
  // Serialized: the single dev worker is not reliable under parallel review turns — at
  // concurrency 2 an occasional transport error aborts an eval mid-test (observed as a
  // tenant-isolation failure with its remaining gates unrecorded).
  maxConcurrency: 1,
  timeoutMs: 120_000,
});
