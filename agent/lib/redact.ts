// PII redaction for untrusted receipt text before it reaches the model.
//
// Payment-card PANs are 13–19 digits, printed on receipts in groups separated by spaces or
// dashes. Anything the model reads it can repeat into the stored decision record, so the
// number is masked before the prompt is built. We rely on the 13+-digit threshold rather
// than a Luhn check: a receipt has no other 13-to-19-digit runs worth preserving, and a
// false positive only over-masks, while a Luhn miss would under-mask a mistyped PAN.
// Comma/period are deliberately not treated as group separators so amounts like $1,280.00
// are never candidates.
const CARD_NUMBER_CANDIDATE = /\d(?:[ -]?\d){12,18}/g;

// The rendered prompt fences receipt text in <receipt_ocr> tags. A receipt that itself
// contains such a tag would close the fence early and let the rest of the text read as
// ordinary prompt — so any submitter-provided tag lookalike is stripped before fencing.
const FENCE_TAG_LOOKALIKE = /<\s*\/?\s*receipt_ocr\s*>/gi;

export function neutralizeFenceTags(text: string): string {
  return text.replace(FENCE_TAG_LOOKALIKE, "[submitter tag removed]");
}

// Masks every digit except the last four, keeping the original grouping, so
// "VISA 4111 1111 1111 1111" becomes "VISA **** **** **** 1111".
export function redactCardNumbers(text: string): string {
  return text.replace(CARD_NUMBER_CANDIDATE, (candidate) => {
    const digitCount = candidate.replace(/[ -]/g, "").length;
    if (digitCount < 13 || digitCount > 19) return candidate;
    let seen = 0;
    return candidate.replace(/\d/g, (digit) => (++seen <= digitCount - 4 ? "*" : digit));
  });
}
