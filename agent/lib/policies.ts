// Synthetic per-company expense policies. Each company sets its own limits, so a
// submission must always be judged against its OWN company's rules.
export type tPolicyRule = {
  id: string;
  category: string;
  text: string;
};

export type tCompanyPolicy = {
  company_id: string;
  company_name: string;
  rules: tPolicyRule[];
};

export const POLICIES: Record<string, tCompanyPolicy> = {
  acme: {
    company_id: "acme",
    company_name: "Acme Robotics",
    rules: [
      { id: "MEAL-01", category: "meals", text: "Business meals are reimbursed up to $50 per attendee; an itemized receipt is required." },
      { id: "TRVL-01", category: "travel", text: "Airfare must be economy. Any single flight over $1,500 requires director approval (flag_for_review)." },
      { id: "SW-01", category: "software", text: "Software or SaaS up to $200 per month is auto-approved; above $200/month requires IT sign-off (flag_for_review)." },
      { id: "ALC-01", category: "alcohol", text: "Alcohol is not reimbursable under any circumstances (reject)." },
    ],
  },
  globex: {
    company_id: "globex",
    company_name: "Globex Corporation",
    rules: [
      { id: "MEAL-01", category: "meals", text: "Meals are capped at $35 per attendee." },
      { id: "TRVL-01", category: "travel", text: "Any travel expense over $2,000 requires finance approval (flag_for_review)." },
      { id: "SW-01", category: "software", text: "Software purchases require VP approval regardless of amount (flag_for_review)." },
      { id: "ENT-01", category: "entertainment", text: "Client entertainment is reimbursed up to $300 per event." },
    ],
  },
  initech: {
    company_id: "initech",
    company_name: "Initech LLC",
    rules: [
      { id: "GEN-01", category: "general", text: "Any expense over $100 requires manager review (flag_for_review)." },
      { id: "MEAL-01", category: "meals", text: "Meals are reimbursed up to $25 per attendee." },
      { id: "OFF-01", category: "office", text: "Office supplies up to $250 are auto-approved." },
      { id: "CASH-01", category: "general", text: "Cash-only receipts with no accompanying card statement are not reimbursable (reject)." },
    ],
  },
};
