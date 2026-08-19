// HTTP channel: POST /eve/v1/review runs one structured review turn and returns the
// decision. Per-request context flows body -> channel state -> metadata(state) ->
// instructions resolver (ctx.channel.metadata). A bare body falls back to the fixture.
//
// Deliberately NOT named `eve.ts`: that file stem overrides eve's default HTTP channel
// and removes the /eve/v1/session* routes that `eve eval`, the dev playground, and SDK
// clients depend on. As `review.ts` this channel adds its route alongside the defaults.
import { z } from "zod";
import { defineChannel, POST, type Session, type SendPayload } from "eve/channels";
import { renderSubmissionContext } from "../lib/build-instructions.js";
import { ExpenseDecisionSchema } from "../lib/expense.schema.js";
import {
  buildRequestView,
  resolveExpenseSubmission,
  type tRequestView,
} from "../lib/request-context.js";

type tJsonOutputSchema = NonNullable<SendPayload["outputSchema"]>;

// eve expects a run-scoped JSON schema (not a Zod object) on the send payload.
function toJsonSchema(schema: z.ZodType): tJsonOutputSchema {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void $schema;
  return rest as tJsonOutputSchema;
}

type tStreamEvent = {
  type: string;
  data?: { result?: unknown; message?: string; code?: string };
};

// Drain the turn's event stream once, capturing the structured result / terminal failure.
async function drainDecision(session: Session): Promise<{ result: unknown; failure: string | null }> {
  const stream = await session.getEventStream();
  const reader = stream.getReader();
  let result: unknown;
  let failure: string | null = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const event = value as tStreamEvent;
      if (event.type === "result.completed") result = event.data?.result;
      if (event.type === "turn.completed") break;
      if (event.type === "turn.failed") {
        failure = `${event.data?.code ?? "unknown"} ${event.data?.message ?? ""}`.trim();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { result, failure };
}

const outputSchema = toJsonSchema(ExpenseDecisionSchema);

export default defineChannel<tRequestView | undefined, { state: tRequestView | undefined }>({
  state: { request: null, contextProvided: false },
  context: (state) => ({ state }),
  metadata: (state) => ({
    request: state?.request ?? null,
    contextProvided: state?.contextProvided ?? false,
  }),
  routes: [
    POST("/eve/v1/review", async (request, { send }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
      }

      const view = buildRequestView(body);
      // The submission rides as a user-role context message; the system prompt stays
      // static so its prefix caches across requests.
      const submission = resolveExpenseSubmission(view);
      const session = await send(
        {
          message: "Review the expense submission and return your decision.",
          context: [renderSubmissionContext(submission, new Date())],
          outputSchema,
        },
        { auth: null, continuationToken: `eve:${crypto.randomUUID()}`, state: view },
      );

      const { result, failure } = await drainDecision(session);
      if (failure) {
        return Response.json({ ok: false, error: `turn failed: ${failure}` }, { status: 502 });
      }

      const parsed = ExpenseDecisionSchema.safeParse(result);
      if (!parsed.success) {
        return Response.json(
          { ok: false, error: "Agent output did not match the decision schema." },
          { status: 502 },
        );
      }

      return Response.json({ ok: true, data: parsed.data }, { status: 200 });
    }),
  ],
});
