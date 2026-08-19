// Shared helper (not an eval): drives the production review endpoint.
//
// Evals that need to control the submission — a specific company, a hostile receipt — POST
// it to POST /eve/v1/review rather than relying on the single fixture the agent process
// falls back to, and get the same code path a real caller exercises.

// Structural type: only the target capability this helper needs.
type tEvalTargetContext = {
  readonly target: { fetch(path: string, init?: RequestInit): Promise<Response> };
};

export type tReviewResult = {
  /** True when the endpoint returned a decision; false when the review itself failed. */
  ok: boolean;
  /** The structured decision, when one was returned. */
  data: unknown;
  /** The whole response body as text, for assertions about what must never appear in it. */
  text: string;
};

export async function reviewSubmission(
  t: tEvalTargetContext,
  submission: Record<string, unknown>,
): Promise<tReviewResult> {
  const response = await t.target.fetch("/eve/v1/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submission),
  });
  const text = await response.text();
  const body = JSON.parse(text) as { ok?: boolean; data?: unknown };
  return { ok: body.ok === true, data: body.data, text };
}
