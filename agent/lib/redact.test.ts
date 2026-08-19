// The masking must catch card numbers in the formats receipts actually print, while never
// touching amounts, invoice numbers, tax ids, or phone-length digit runs.
import { describe, expect, test } from "bun:test";
import { redactCardNumbers } from "./redact.js";

describe("redactCardNumbers", () => {
  test("masks a space-grouped 16-digit PAN, keeping the last four", () => {
    expect(redactCardNumbers("Paid with VISA 4111 1111 1111 1111")).toBe(
      "Paid with VISA **** **** **** 1111",
    );
  });

  test("masks a dash-grouped PAN and an ungrouped PAN", () => {
    expect(redactCardNumbers("5500-0000-0000-0004")).toBe("****-****-****-0004");
    expect(redactCardNumbers("4111111111111111")).toBe("************1111");
  });

  test("masks every PAN when several appear", () => {
    const twice = redactCardNumbers("4111 1111 1111 1111 then 5500 0000 0000 0004");
    expect(twice).toBe("**** **** **** 1111 then **** **** **** 0004");
  });

  test("leaves amounts, invoice numbers, tax ids, and short digit runs untouched", () => {
    const untouched = [
      "TOTAL: $1,280.00",
      "Invoice #INV-8841",
      "RFC: XAXX010101000",
      "Tel: 555 010 1234",
      "Card: **** **** **** 7788",
      "Date: 2026-07-18",
    ];
    for (const line of untouched) {
      expect(redactCardNumbers(line)).toBe(line);
    }
  });

  test("masks the fixture receipts' PANs end to end", () => {
    const receipt =
      "DINER 88\nBurgers x2 .... $28.00\nTOTAL ......... $40.00\n" +
      "Paid: MASTERCARD 5500 0000 0000 0004\nRFC: XAXX010101000";
    const redacted = redactCardNumbers(receipt);
    expect(redacted).toContain("**** **** **** 0004");
    expect(redacted).not.toContain("5500 0000 0000 0004");
    expect(redacted).toContain("$28.00");
    expect(redacted).toContain("RFC: XAXX010101000");
  });
});
