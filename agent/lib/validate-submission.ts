// Deterministic sanity checks for an expense submission. Pure logic, no model judgment:
// the numeric cross-checks a reviewer would do on a calculator live here, so the model can
// cite them instead of doing arithmetic in prose.
import { type tExpenseSubmission } from "./request-context.js";

// Two cent-amounts are equal when they round to the same cent (floats from JSON).
const CENT_TOLERANCE = 0.005;

export type tSubmissionValidation = {
  /** True when no issue was found. */
  valid: boolean;
  /** Human-readable findings, empty when valid. */
  issues: string[];
  /** Sum of the line items, when any were provided. */
  line_items_total?: number;
};

export function validateSubmission(submission: tExpenseSubmission): tSubmissionValidation {
  const issues: string[] = [];

  if (!submission.company_id) issues.push("company_id is missing.");
  if (!submission.category) issues.push("category is missing.");
  if (!submission.receipt?.trim()) issues.push("receipt text is missing or empty.");

  if (typeof submission.claimed_amount !== "number" || Number.isNaN(submission.claimed_amount)) {
    issues.push("claimed_amount is not a number.");
  } else if (submission.claimed_amount <= 0) {
    issues.push(`claimed_amount must be positive (got ${submission.claimed_amount}).`);
  }

  let lineItemsTotal: number | undefined;
  const lineItems = submission.line_items ?? [];
  if (lineItems.length > 0) {
    lineItemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const difference = submission.claimed_amount - lineItemsTotal;
    if (Math.abs(difference) > CENT_TOLERANCE) {
      issues.push(
        `line items sum to ${lineItemsTotal.toFixed(2)} but the claimed amount is ` +
          `${submission.claimed_amount.toFixed(2)} (difference ${difference.toFixed(2)}). ` +
          "The claimed amount is not supported by the itemization.",
      );
    }
  }

  const result: tSubmissionValidation = { valid: issues.length === 0, issues };
  if (lineItemsTotal !== undefined) result.line_items_total = lineItemsTotal;
  return result;
}
