// Retrieves the expense policy rules for the company under review.
//
// The company is read from the authoritative submission seeded by the instructions
// resolver, never from a model-supplied argument: the receipt is untrusted OCR text, and a
// tool argument the model controls is a path for that text to pull in another company's
// policy.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchPolicy } from "../lib/policy-store.js";
import { submissionState } from "../lib/request-context.js";

export default defineTool({
  description:
    "Look up the expense policy rules that apply to the submission under review. The company " +
    "is resolved automatically from the submission. Optionally pass a topic (a category or " +
    "keyword) to narrow the rules returned, e.g. 'meals', 'travel', 'software', 'alcohol'.",
  inputSchema: z.object({
    topic: z
      .string()
      .optional()
      .describe("Optional category or keyword to narrow the rules returned."),
  }),
  async execute({ topic }) {
    const submission = submissionState.get();
    if (!submission) {
      throw new Error("No expense submission is in scope for this turn; cannot look up a policy.");
    }
    return searchPolicy(submission.company_id, topic);
  },
});
