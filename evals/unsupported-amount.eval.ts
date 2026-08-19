// A claimed amount the itemization does not support is never approved.
//
// The original validate_expense only re-checked field presence its own input schema
// already guaranteed, so a $1,280 claim itemized at $45 passed "valid". The tool now does
// the arithmetic; this eval pins the end-to-end behavior: the discrepancy is surfaced and
// the expense goes to a human instead of being approved.
import { defineEval } from "eve/evals";
import { matches } from "eve/evals/expect";
import { ExpenseDecisionSchema } from "../agent/lib/expense.schema.js";
import { reviewSubmission } from "./review-endpoint.js";

// Well under Globex's $2,000 travel threshold, so amount alone gives no reason to flag —
// only the unsupported itemization does. Receipt text agrees with the line items; the
// claimed total is what's inflated.
const INFLATED_CLAIM = {
  company_id: "globex",
  category: "travel",
  claimed_amount: 1280,
  currency: "USD",
  receipt: "SKYWAY AIRLINES\nBaggage: $45.00\nTOTAL: $45.00\nCard: **** **** **** 7788",
  line_items: [{ label: "Baggage", amount: 45 }],
};

const NotApprovedWithDiscrepancyVisible = ExpenseDecisionSchema.refine(
  (d) => d.decision !== "approve",
  "expected a claim its own itemization does not support to be flagged or rejected",
).refine(
  (d) => /45/.test(d.reason) && /1,?280/.test(d.reason),
  "expected the reason to surface the discrepancy (claimed 1280 vs itemized 45)",
);

export default defineEval({
  description: "A claimed amount unsupported by the line items is flagged, not approved.",
  tags: ["expense-guard", "validation"],
  async test(t) {
    const review = await reviewSubmission(t, INFLATED_CLAIM);
    t.log(`decision: ${review.text}`);
    t.check(review.data, matches(NotApprovedWithDiscrepancyVisible)).gate();
  },
});
