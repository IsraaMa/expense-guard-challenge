// Dynamic instructions resolver. Runs at turn open, resolves the submission from the
// channel metadata (or the fixture in dev / eval) and seeds it into submissionState so
// tools read the authoritative fields instead of model-provided arguments.
//
// The returned instructions are fully static: the submission itself reaches the model as a
// user-role context message added by the channel (see agent/channels/*), keeping the
// system prompt a stable, provider-cacheable prefix across requests.
import { defineDynamic, defineInstructions } from "eve/instructions";
import { buildSystemPrompt } from "../lib/build-instructions.js";
import { resolveExpenseSubmission, submissionState } from "../lib/request-context.js";

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const submission = resolveExpenseSubmission(ctx.channel.metadata);
      submissionState.update(() => submission);
      return defineInstructions({ markdown: buildSystemPrompt() });
    },
  },
});
