// Regression tests for the deterministic submission checks. The original tool only
// re-checked field presence its input schema already guaranteed, so a claimed amount with
// no itemization support sailed through "valid".
import { describe, expect, test } from "bun:test";
import { type tExpenseSubmission } from "./request-context.js";
import { validateSubmission } from "./validate-submission.js";

const BASE: tExpenseSubmission = {
  company_id: "acme",
  category: "meals",
  claimed_amount: 96,
  receipt: "OLIVE & VINE BISTRO\nTOTAL ... $96.00",
  line_items: [
    { label: "Entrees", amount: 72 },
    { label: "Sodas & juice", amount: 12 },
    { label: "Sales tax", amount: 12 },
  ],
};

describe("validateSubmission", () => {
  test("a consistent submission is valid", () => {
    const result = validateSubmission(BASE);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.line_items_total).toBe(96);
  });

  test("flags a claimed amount the line items do not support", () => {
    // The illegible-receipt scenario: $1,280 claimed, only $45 itemized.
    const result = validateSubmission({
      ...BASE,
      claimed_amount: 1280,
      line_items: [{ label: "Baggage", amount: 45 }],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("1280.00");
    expect(result.issues.join(" ")).toContain("45.00");
  });

  test("tolerates float rounding at the cent level", () => {
    const result = validateSubmission({
      ...BASE,
      claimed_amount: 0.3,
      line_items: [
        { label: "a", amount: 0.1 },
        { label: "b", amount: 0.2 },
      ],
    });
    expect(result.valid).toBe(true);
  });

  test("a submission without line items is not penalized for the missing itemization", () => {
    const { line_items, ...noItems } = BASE;
    void line_items;
    const result = validateSubmission(noItems);
    expect(result.valid).toBe(true);
    expect(result.line_items_total).toBeUndefined();
  });

  test("flags missing fields and non-positive amounts", () => {
    const result = validateSubmission({
      ...BASE,
      category: "",
      receipt: "  ",
      claimed_amount: 0,
      line_items: [],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("category");
    expect(result.issues.join(" ")).toContain("receipt");
    expect(result.issues.join(" ")).toContain("positive");
  });
});
