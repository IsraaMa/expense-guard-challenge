// Sanity-checks the submission under review before the model decides.
//
// Takes no arguments: it reads the authoritative submission seeded by the instructions
// resolver, so the model cannot (accidentally or under a hostile receipt's influence)
// validate different numbers than the ones actually submitted.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { submissionState } from "../lib/request-context.js";
import { validateSubmission } from "../lib/validate-submission.js";

export default defineTool({
  description:
    "Sanity-check the submission under review: core fields are present and the line items " +
    "add up to the claimed amount. Reads the submission directly; takes no arguments.",
  inputSchema: z.object({}),
  async execute() {
    const submission = submissionState.get();
    if (!submission) {
      throw new Error("No expense submission is in scope for this turn; nothing to validate.");
    }
    return validateSubmission(submission);
  },
});
