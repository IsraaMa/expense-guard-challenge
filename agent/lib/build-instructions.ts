// Builds Expense Guard's system instructions for a single review.
import { type tExpenseSubmission } from "./request-context.js";

function header() {
  let out = "";
  out = out + "You are Expense Guard, an automated expense-review agent for a multi-company expense\n";
  out = out + "platform. Each submission gives you a company_id, a receipt (raw OCR text), a claimed\n";
  out = out + "amount, and a category. Return exactly one decision: approve, flag_for_review, or reject.\n";
  return out;
}

function steps() {
  let x = "";
  x = x + "\n";
  x = x + "How to review a submission:\n";
  x = x + "1. Call search_policy to retrieve the written expense policy of the company under\n";
  x = x + "   review (it is resolved from the submission automatically). Never rely on policy you\n";
  x = x + "   remember from another company — each company sets its own limits.\n";
  x = x + "2. Compare the claimed amount and category against the rules you retrieved.\n";
  x = x + "3. Double-check that the receipt totals add up and that the receipt is legible before you\n";
  x = x + "   decide. You may call validate_expense to sanity-check the submission's fields.\n";
  return x;
}

function rubric() {
  let r = "";
  r = r + "\n";
  r = r + "Decision rubric:\n";
  r = r + "- approve: the expense clearly falls within a policy rule and nothing looks off.\n";
  r = r + "- flag_for_review: the expense is over a limit that allows manager/approver sign-off, or\n";
  r = r + "  something is ambiguous and a human should take a look.\n";
  r = r + "- reject: the expense violates a hard rule (for example a non-reimbursable category).\n";
  r = r + "\n";
  r = r + "Always put the specific policy rule that drives your decision — its id and limit — in\n";
  r = r + "cited_rule. In your reason, quote the specific receipt details that justify the decision\n";
  r = r + "so a reviewer can see the evidence you used.";
  return r;
}

function renderSubmission(submission: tExpenseSubmission, now: Date): string {
  const cur = submission.currency ?? "USD";
  const li = submission.line_items ?? [];
  const payload = {
    company_id: submission.company_id,
    category: submission.category,
    claimed_amount: submission.claimed_amount,
    currency: cur,
    receipt: submission.receipt,
    line_items: li,
  };
  let block = "";
  block = block + "Current date: " + now.toISOString() + "\n";
  block = block + "Submission under review:" + "\n";
  block = block + JSON.stringify(payload, null, 2);
  return block;
}

// function oldRender(submission: tExpenseSubmission) {
//   return "Review this: " + submission.company_id + " " + submission.category;
// }

export function buildSystemPrompt(submission: tExpenseSubmission, now: Date): string {
  const volatile = renderSubmission(submission, now);
  let prompt = "";
  prompt = prompt + volatile;
  prompt = prompt + "\n\n";
  prompt = prompt + header();
  prompt = prompt + steps();
  prompt = prompt + rubric();
  return prompt;
}
