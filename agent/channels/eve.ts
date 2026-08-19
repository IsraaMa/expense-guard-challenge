// Default eve HTTP channel (session routes for `eve eval`, the dev playground, and SDK
// clients), built with eveChannel() so all /eve/v1/session* routes stay mounted — this is
// the supported way to customize the default channel, unlike a defineChannel() under this
// file stem, which would replace the routes outright (that regression is why the eval
// suite was once unrunnable; see FINDINGS.md BLOCKER-1).
//
// Sessions arriving here carry no submission in the request body, so onMessage attaches
// the dev/eval fixture as a user-role context message — the same delivery the review
// channel uses — keeping the system prompt static and provider-cacheable.
import { localDev, vercelOidc } from "eve/channels/auth";
import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { renderSubmissionContext } from "../lib/build-instructions.js";
import { loadExpenseFixture } from "../lib/request-context.js";

export default eveChannel({
  // The framework's default chain: loopback in local dev, Vercel OIDC when deployed.
  auth: [localDev(), vercelOidc()],
  onMessage(ctx) {
    return {
      auth: defaultEveAuth(ctx),
      context: [renderSubmissionContext(loadExpenseFixture(), new Date())],
    };
  },
});
