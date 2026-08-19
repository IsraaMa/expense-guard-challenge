// Loads and searches a company's expense policy for the search_policy tool.
//
// Tenant isolation rule: a lookup only ever returns the policy of the company that was
// asked for. There is no cache between lookups and no default company to fall back on —
// either the company has a configured policy or the lookup fails loudly.
import { POLICIES, type tCompanyPolicy, type tPolicyRule } from "./policies.js";

function getCompanyPolicy(companyId: string): tCompanyPolicy {
  const policy = POLICIES[companyId];
  if (!policy) {
    throw new Error(
      `No expense policy is configured for company "${companyId}". Refusing to review this ` +
        "submission against another company's policy.",
    );
  }
  return policy;
}

// Rules whose category or text mentions the topic; falls back to the full policy so the
// model never has to decide from an empty rule set. Rules in the "general" category apply
// to every expense regardless of topic (e.g. Initech's cash-only and over-$100 rules), so
// narrowing must never hide them — a meals-topic lookup that omitted CASH-01 caused a
// cash-paid lunch to be approved.
function selectRules(policy: tCompanyPolicy, topic: string | undefined): tPolicyRule[] {
  if (!topic) return policy.rules;
  const needle = topic.toLowerCase();
  const hits = policy.rules.filter(
    (rule) =>
      rule.category.toLowerCase().includes(needle) || rule.text.toLowerCase().includes(needle),
  );
  if (hits.length === 0) return policy.rules;
  const crossCutting = policy.rules.filter(
    (rule) => rule.category === "general" && !hits.includes(rule),
  );
  return [...hits, ...crossCutting];
}

function formatRules(rules: tPolicyRule[]): string {
  return rules.map((rule) => `[${rule.id}] (${rule.category}) ${rule.text}`).join("\n");
}

export function searchPolicy(
  companyId: string,
  topic: string | undefined,
): { company_id: string; company_name: string; rules: string } {
  const policy = getCompanyPolicy(companyId);
  return {
    company_id: policy.company_id,
    company_name: policy.company_name,
    rules: formatRules(selectRules(policy, topic)),
  };
}
