// Expense Guard — a multi-company expense-review agent. Reviews one expense submission
// (company_id + receipt + claimed amount + category) against that company's written
// policy and returns a structured decision: approve / flag_for_review / reject.
//
// Schema-output agent WITH tools: it emits the decision through `outputSchema`, and
// drives to that decision by calling search_policy (fetch the company policy) and
// validate_expense (sanity-check the submission). Eve binds `model` statically at build
// time — there is no runtime model override.
import { defineAgent } from "eve";
import { ExpenseDecisionSchema } from "./lib/expense.schema.js";

export default defineAgent({
  model: "anthropic/claude-sonnet-4.5",
  outputSchema: ExpenseDecisionSchema,
});
