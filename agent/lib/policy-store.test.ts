// Tenant-isolation regression tests for the policy store. These are deterministic (no
// model involved), so they run in milliseconds and fail loudly on any change that lets one
// company's policy reach another company's review.
import { describe, expect, test } from "bun:test";
import { searchPolicy } from "./policy-store.js";

describe("searchPolicy", () => {
  test("returns each company's own policy regardless of lookup order", () => {
    // Regression: a module-level cache used to pin the first company looked up, so every
    // later review in the same process was judged against that first company's policy.
    expect(searchPolicy("acme", undefined).company_id).toBe("acme");
    expect(searchPolicy("initech", undefined).company_id).toBe("initech");
    expect(searchPolicy("globex", undefined).company_id).toBe("globex");
    expect(searchPolicy("acme", undefined).company_id).toBe("acme");
  });

  test("returns the company's own limits, not another company's", () => {
    expect(searchPolicy("acme", "meals").rules).toContain("$50 per attendee");
    expect(searchPolicy("initech", "meals").rules).toContain("$25 per attendee");
    expect(searchPolicy("initech", "meals").rules).not.toContain("$50 per attendee");
  });

  test("fails loudly for an unknown company instead of falling back to a default", () => {
    // Regression: an unknown company_id used to silently receive Acme's policy.
    expect(() => searchPolicy("no-such-company", undefined)).toThrow(/no-such-company/);
  });

  test("narrows to the matching rules, and returns the full policy when nothing matches", () => {
    const alcohol = searchPolicy("acme", "alcohol").rules;
    expect(alcohol).toContain("ALC-01");
    expect(alcohol).not.toContain("MEAL-01");

    const unmatched = searchPolicy("acme", "zzz-no-such-topic").rules;
    expect(unmatched).toContain("MEAL-01");
    expect(unmatched).toContain("ALC-01");
  });
});
