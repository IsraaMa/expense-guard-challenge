// A review is always decided under the submitting company's own policy.
//
// This is the executable spec for the cross-tenant leak: a process-wide cache used to pin
// the first company reviewed, so the SECOND company below was judged against the FIRST
// company's limits. Order matters — reviewing Acme first is what poisoned the cache — so
// this eval deliberately drives two companies through the live review endpoint in sequence.
import { defineEval } from "eve/evals";
import { matches } from "eve/evals/expect";
import { z } from "zod";
import { ExpenseDecisionSchema } from "../agent/lib/expense.schema.js";
import { reviewSubmission } from "./review-endpoint.js";

// Acme reimburses meals up to $50 per attendee; Initech up to $25. A decision that quotes
// the wrong company's limit is the leak, even when the approve/reject outcome coincides.
const ACME_MEAL = {
  company_id: "acme",
  category: "meals",
  claimed_amount: 96,
  currency: "USD",
  receipt: "OLIVE & VINE BISTRO\nTable of 2\nEntrees .... $72.00\nTax ........ $24.00\nTOTAL ...... $96.00",
  line_items: [
    { label: "Entrees", amount: 72 },
    { label: "Tax", amount: 24 },
  ],
};

const INITECH_MEAL = {
  company_id: "initech",
  category: "meals",
  claimed_amount: 40,
  currency: "USD",
  receipt: "DINER 88\nBurgers x2 .... $28.00\nDrinks ........ $6.00\nTax ........... $6.00\nTOTAL ......... $40.00",
  line_items: [
    { label: "Burgers", amount: 28 },
    { label: "Drinks", amount: 6 },
    { label: "Tax", amount: 6 },
  ],
};

const UNKNOWN_COMPANY_MEAL = {
  company_id: "definitely-not-a-customer",
  category: "meals",
  claimed_amount: 45,
  currency: "USD",
  receipt: "CAFE X\nLunch ... $45.00\nTOTAL ... $45.00",
};

// Acme's signature limit as a phrase, so legitimate arithmetic like "up to $50 for 2
// attendees" ($25 x 2 under Initech's own rule) doesn't false-positive — the leak is a
// per-attendee LIMIT of $50 being cited, not the number 50 appearing.
const ACME_MEAL_LIMIT = /\$\s?50(?:\.00)?\s?(?:\/|per\s)\s?attendee/i;

const DecidedUnderInitechPolicy = ExpenseDecisionSchema.refine(
  (d) => /\$\s?25\b/.test(d.cited_rule),
  "expected the decision to cite Initech's own $25 per-attendee meal limit",
).refine(
  (d) => !ACME_MEAL_LIMIT.test(`${d.cited_rule} ${d.reason}`),
  "expected no trace of Acme's $50-per-attendee limit in an Initech decision",
);

// Refusing the review outright is an equally valid outcome for an unconfigured company, so
// these assert the security property itself rather than one specific shape of response.
const NoOtherCompanysLimitAnywhere = z
  .string()
  .refine(
    (body) => !ACME_MEAL_LIMIT.test(body),
    "expected no other company's limits anywhere in the response for an unconfigured company",
  );

const NotApproved = z
  .string()
  .refine((decision) => decision !== "approve", "expected no approval on borrowed policy");

export default defineEval({
  description: "Each company's expenses are decided under that company's own policy.",
  tags: ["expense-guard", "tenant-isolation", "security"],
  async test(t) {
    // Reviewing Acme first is the precondition that used to poison the policy cache.
    const acme = await reviewSubmission(t, ACME_MEAL);
    t.log(`acme decision: ${acme.text}`);
    t.check(acme.data, matches(ExpenseDecisionSchema)).gate();

    const initech = await reviewSubmission(t, INITECH_MEAL);
    t.log(`initech decision: ${initech.text}`);
    t.check(initech.data, matches(DecidedUnderInitechPolicy)).gate();

    const unknown = await reviewSubmission(t, UNKNOWN_COMPANY_MEAL);
    t.log(`unknown-company response: ${unknown.text}`);
    const outcome = ExpenseDecisionSchema.safeParse(unknown.data);
    t.check(unknown.text, matches(NoOtherCompanysLimitAnywhere)).gate();
    t.check(
      outcome.success ? outcome.data.decision : "review_refused",
      matches(NotApproved),
    ).gate();
  },
});
