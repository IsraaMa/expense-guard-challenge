// One case per policy rule that no other eval exercises, so every written rule in
// policies.ts has at least one executable spec proving the agent applies it.
//
// Kept efficient on purpose: the dataset is inline (6 rows, visible at a glance), each case
// is a single review turn, and every gate is deterministic — decision within the allowed
// set and the driving rule's id in cited_rule — so no judge tokens are spent. Amounts are
// chosen so exactly one rule decides each case (e.g. initech office supplies at $80 stay
// under GEN-01's $100 review threshold so only OFF-01 applies), and line items always sum
// to the claimed amount so the P1-6 checks stay silent. Where a policy's wording leaves the
// over-limit outcome open ("capped at $35" — hard reject or human sign-off?), the case
// accepts either non-approval rather than pinning one reading of the rule.
import { defineEval } from "eve/evals";
import { matches } from "eve/evals/expect";
import { ExpenseDecisionSchema, type tExpenseDecision } from "../agent/lib/expense.schema.js";
import { reviewSubmission } from "./review-endpoint.js";

type tPolicyCase = {
  name: string;
  submission: Record<string, unknown>;
  allowedDecisions: readonly tExpenseDecision["decision"][];
  ruleId: string;
};

const CASES: tPolicyCase[] = [
  {
    name: "acme: alcohol is never reimbursable (ALC-01)",
    submission: {
      company_id: "acme",
      category: "alcohol",
      claimed_amount: 32,
      currency: "USD",
      receipt: "THE CELLAR\nWine (bottle) .... $32.00\nTOTAL ............ $32.00\nCard: **** 0198",
      line_items: [{ label: "Wine", amount: 32 }],
    },
    allowedDecisions: ["reject"],
    ruleId: "ALC-01",
  },
  {
    name: "initech: cash-only receipt is not reimbursable even within meal limits (CASH-01)",
    submission: {
      company_id: "initech",
      category: "meals",
      claimed_amount: 20,
      currency: "USD",
      receipt: "TACOS EL PATIO\nLunch ..... $20.00\nTOTAL ..... $20.00\nPAID CASH — no card",
      line_items: [{ label: "Lunch", amount: 20 }],
    },
    allowedDecisions: ["reject"],
    ruleId: "CASH-01",
  },
  {
    name: "globex: client entertainment within the $300 event cap is approved (ENT-01)",
    submission: {
      company_id: "globex",
      category: "entertainment",
      claimed_amount: 250,
      currency: "USD",
      receipt: "CITY BOWLING CLUB\nClient event, lane hire .... $250.00\nTOTAL .... $250.00\nVISA **** 7788",
      line_items: [{ label: "Lane hire (client event)", amount: 250 }],
    },
    allowedDecisions: ["approve"],
    ruleId: "ENT-01",
  },
  {
    name: "globex: a meal over the $35-per-attendee cap is not approved (MEAL-01)",
    submission: {
      company_id: "globex",
      category: "meals",
      claimed_amount: 80,
      currency: "USD",
      receipt: "BRASSERIE NORD\nDinner for 2 .... $80.00\nTOTAL ........... $80.00\nAMEX **** 3001",
      line_items: [{ label: "Dinner for 2", amount: 80 }],
    },
    allowedDecisions: ["reject", "flag_for_review"],
    ruleId: "MEAL-01",
  },
  {
    name: "acme: a flight over $1,500 needs director approval (TRVL-01)",
    submission: {
      company_id: "acme",
      category: "travel",
      claimed_amount: 1800,
      currency: "USD",
      receipt: "TRANSPACIFIC AIR\nEconomy fare SFO-NRT .... $1800.00\nTOTAL .... $1800.00\nVISA **** 0198",
      line_items: [{ label: "Economy fare", amount: 1800 }],
    },
    allowedDecisions: ["flag_for_review"],
    ruleId: "TRVL-01",
  },
  {
    name: "initech: office supplies under every threshold are approved (OFF-01)",
    submission: {
      company_id: "initech",
      category: "office",
      claimed_amount: 80,
      currency: "USD",
      receipt: "OFFICE DEPOT\nToner + paper .... $80.00\nTOTAL ............ $80.00\nMC **** 0004",
      line_items: [{ label: "Toner + paper", amount: 80 }],
    },
    allowedDecisions: ["approve"],
    ruleId: "OFF-01",
  },
];

function decidedByRule(policyCase: tPolicyCase) {
  return ExpenseDecisionSchema.refine(
    (d) => policyCase.allowedDecisions.includes(d.decision),
    `expected one of [${policyCase.allowedDecisions.join(", ")}]`,
  ).refine(
    (d) => d.cited_rule.toUpperCase().includes(policyCase.ruleId),
    `expected the decision to cite ${policyCase.ruleId}`,
  );
}

export default CASES.map((policyCase) =>
  defineEval({
    description: policyCase.name,
    tags: ["expense-guard", "policy-coverage"],
    async test(t) {
      const review = await reviewSubmission(t, policyCase.submission);
      t.log(`decision: ${review.text}`);
      t.check(review.data, matches(decidedByRule(policyCase))).gate();
    },
  }),
);
