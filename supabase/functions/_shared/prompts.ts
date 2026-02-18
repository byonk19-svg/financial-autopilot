/**
 * AI Prompt Templates — Financial Autopilot
 *
 * This module exports prompt builders for each AI-assisted feature in the
 * application. Every exported function returns a `{ system, user }` object
 * ready to pass to any OpenAI-compatible chat-completion API.
 *
 * Conventions:
 *  - System prompts define the model's role, output format, and hard rules.
 *  - User prompts are built from live data and are kept terse so token
 *    budgets stay predictable.
 *  - All monetary values are formatted as USD strings by the caller before
 *    being interpolated (e.g. "$12.99") to avoid ambiguity.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ChatPrompt = {
  system: string;
  user: string;
};

// ---------------------------------------------------------------------------
// 1. Weekly Financial Insights
// ---------------------------------------------------------------------------

export type WeeklyInsightsInput = {
  weekOf: string; // ISO date of Monday, e.g. "2026-02-16"
  mtdSpend: string; // formatted USD month-to-date spend
  projectedSpend: string; // formatted USD projected end-of-month spend
  lastMonthSpend: string; // formatted USD previous month total
  paceRatioPct: number | null; // e.g. 112 means 112 % of last month's pace
  weekendAvgDaily: string; // formatted USD
  weekdayAvgDaily: string; // formatted USD
  weekendVsWeekdayPct: number | null; // signed percentage, positive = weekend higher
  topMerchant: string | null;
  topMerchantSpend: string | null; // formatted USD
  topCategory: string | null;
  topCategorySpend: string | null; // formatted USD
  activeSubscriptions: Array<{
    name: string;
    cadence: string;
    lastCharge: string; // formatted USD
    annualized: string; // formatted USD
    priceIncreased: boolean;
  }>;
  subscriptionAnnualizedTotal: string; // formatted USD
};

/**
 * Generates a concise weekly financial summary the user will see in their
 * insights feed. The model must return three short paragraphs: pattern,
 * money-leak, and projection — no markdown headers, no bullet lists.
 */
export function buildWeeklyInsightsPrompt(input: WeeklyInsightsInput): ChatPrompt {
  const subscriptionLines = input.activeSubscriptions
    .map(
      (s) =>
        `${s.name} (${s.cadence}): ${s.lastCharge}/charge, ~${s.annualized}/yr${s.priceIncreased ? " ⚑ price increased" : ""}`,
    )
    .join("\n");

  const paceNote = input.paceRatioPct !== null
    ? `Projected month-end spend is ${input.projectedSpend} (${input.paceRatioPct > 100 ? "+" : ""}${input.paceRatioPct - 100}% vs last month's ${input.lastMonthSpend}).`
    : `Projected month-end spend is ${input.projectedSpend}. Last month total was ${input.lastMonthSpend}.`;

  const weekendNote = input.weekendVsWeekdayPct !== null
    ? `Weekend daily average is ${input.weekendAvgDaily} (${input.weekendVsWeekdayPct >= 0 ? "+" : ""}${input.weekendVsWeekdayPct.toFixed(1)}% vs weekday average of ${input.weekdayAvgDaily}).`
    : `Weekend daily average is ${input.weekendAvgDaily}; weekday average is ${input.weekdayAvgDaily}.`;

  const topDriverNote = input.topMerchant && input.topMerchantSpend
    ? `Top spending merchant this month: ${input.topMerchant} at ${input.topMerchantSpend}.`
    : input.topCategory && input.topCategorySpend
    ? `Top spending category this month: ${input.topCategory} at ${input.topCategorySpend}.`
    : "No dominant spending driver identified this month.";

  return {
    system: `You are a personal finance assistant writing concise weekly insight summaries for a budgeting app.

Rules:
- Write exactly three short paragraphs separated by blank lines.
- Paragraph 1: spending pattern (weekend vs weekday behavior, what it might indicate).
- Paragraph 2: subscription/money-leak check (highlight any price increases, flag services worth reviewing).
- Paragraph 3: month pace projection and the top spending driver.
- Do NOT use markdown headers, bullet lists, bold, or italic text.
- Use plain, friendly, direct language. Maximum 60 words per paragraph.
- Never invent numbers. Only reference figures provided in the user message.
- Do not give investment advice or mention specific financial products.`,

    user: `Week of ${input.weekOf}.

SPENDING PATTERN
${weekendNote}

MONTH PACE
Month-to-date: ${input.mtdSpend}. ${paceNote}
${topDriverNote}

SUBSCRIPTIONS (active, charged last 30 days)
${subscriptionLines || "None detected."}
Estimated annualized subscription cost: ${input.subscriptionAnnualizedTotal}.

Write the three-paragraph weekly summary now.`,
  };
}

// ---------------------------------------------------------------------------
// 2. Transaction Categorization
// ---------------------------------------------------------------------------

export type CategorizationInput = {
  descriptionRaw: string;
  merchantNormalized: string | null;
  amount: string; // formatted USD, always positive
  availableCategories: string[]; // user-defined category names
};

/**
 * Suggests the best-fit category for a single transaction.
 * The model must reply with exactly one category name from the provided list,
 * or the literal string "uncategorized" if none fit.
 */
export function buildCategorizationPrompt(input: CategorizationInput): ChatPrompt {
  const categoriesList = input.availableCategories.join(", ");

  return {
    system: `You are a transaction categorization engine for a personal finance app.

Rules:
- Reply with exactly one word or short phrase: the best-fit category name from the list provided.
- If no category fits, reply with exactly: uncategorized
- Do not add punctuation, explanation, or any other text.
- Match on merchant name and transaction description, not amount.
- Available categories: ${categoriesList}`,

    user: `Categorize this transaction.

Description: ${input.descriptionRaw}
Merchant: ${input.merchantNormalized ?? "unknown"}
Amount: ${input.amount}`,
  };
}

// ---------------------------------------------------------------------------
// 3. Subscription / Recurring Charge Classification
// ---------------------------------------------------------------------------

export type RecurringClassificationInput = {
  merchantName: string;
  cadence: "weekly" | "monthly" | "quarterly" | "yearly" | "unknown";
  lastCharge: string; // formatted USD
  occurrences: number;
  confidenceScore: number; // 0–1
};

export type RecurringClassificationResult =
  | "subscription"
  | "bill_loan"
  | "transfer"
  | "ignore"
  | "needs_review";

/**
 * Classifies a detected recurring charge into one of the four canonical types.
 * The model must reply with exactly one of: subscription | bill_loan | transfer | ignore | needs_review
 */
export function buildRecurringClassificationPrompt(
  input: RecurringClassificationInput,
): ChatPrompt {
  return {
    system: `You are a recurring-charge classifier for a personal finance app.

Reply with exactly one of these labels — nothing else:
  subscription  → digital/streaming/SaaS services (Netflix, Spotify, cloud storage, etc.)
  bill_loan     → utilities, rent, mortgage, insurance, loan repayments, phone/internet bills
  transfer      → internal money movements, bank transfers, peer payments (Venmo, Zelle, etc.)
  ignore        → payroll deposits, tax refunds, ATM cash, or other items to exclude
  needs_review  → ambiguous; insufficient signal to classify confidently

Do not include punctuation, explanation, or any other text.`,

    user: `Merchant: ${input.merchantName}
Cadence: ${input.cadence}
Last charge: ${input.lastCharge}
Occurrences detected: ${input.occurrences}
Detection confidence: ${(input.confidenceScore * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// 4. Alert Narrative Generation
// ---------------------------------------------------------------------------

export type AlertNarrativeInput = {
  alertType: "unusual_charge" | "duplicate_charge" | "subscription_increase" | "pace_warning" | "bill_spike";
  severity: "low" | "medium" | "high";
  merchantName: string | null;
  amount: string | null; // formatted USD
  metadata: Record<string, unknown>;
};

/**
 * Rewrites an auto-generated alert body into a friendly, actionable one-sentence
 * notification the user sees in their alert feed.
 */
export function buildAlertNarrativePrompt(input: AlertNarrativeInput): ChatPrompt {
  const metaSummary = Object.entries(input.metadata)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");

  return {
    system: `You are writing push-notification copy for a personal finance app.

Rules:
- Write exactly one sentence (max 20 words) that describes what happened and what the user should do.
- Be specific: mention the merchant name and amount when available.
- Never use jargon. Use plain English.
- Do not start with "Alert:", "Note:", or similar prefixes.
- Do not add punctuation at the end (no period).`,

    user: `Alert type: ${input.alertType}
Severity: ${input.severity}
Merchant: ${input.merchantName ?? "unknown"}
Amount: ${input.amount ?? "unknown"}
Details: ${metaSummary}

Write the one-sentence notification now.`,
  };
}

// ---------------------------------------------------------------------------
// 5. Merchant Name Normalization
// ---------------------------------------------------------------------------

export type MerchantNormalizationInput = {
  rawDescriptions: string[]; // 1–10 raw transaction description strings for the same payee
};

/**
 * Produces a clean, human-readable merchant name from raw bank description strings.
 * The model replies with a single short name (e.g. "Netflix", "Whole Foods").
 */
export function buildMerchantNormalizationPrompt(input: MerchantNormalizationInput): ChatPrompt {
  const descriptionBlock = input.rawDescriptions
    .map((d, i) => `${i + 1}. ${d}`)
    .join("\n");

  return {
    system: `You are a merchant name normalizer for a bank transaction processor.

Rules:
- Reply with exactly one short, clean merchant name (e.g. "Netflix", "Amazon", "Whole Foods Market").
- Capitalize properly. Remove reference numbers, card identifiers, location codes, and date fragments.
- If the descriptions clearly refer to different merchants, return the most common one.
- Maximum 5 words. No punctuation at the end. No explanation.`,

    user: `Raw transaction descriptions:
${descriptionBlock}

Return the normalized merchant name.`,
  };
}

// ---------------------------------------------------------------------------
// 6. Spending Coach — Personalized Financial Advice
// ---------------------------------------------------------------------------

export type SpendingCoachInput = {
  monthlyBudget: string | null; // formatted USD, null if not set
  mtdSpend: string; // formatted USD
  projectedSpend: string; // formatted USD
  topCategories: Array<{ name: string; spend: string }>; // max 5, sorted desc
  subscriptionCount: number;
  subscriptionAnnualizedTotal: string; // formatted USD
  hasRecentPriceIncrease: boolean;
  hasUnusualCharge: boolean;
};

/**
 * Produces 2–3 short, personalized money-saving tips based on the user's
 * current month spending profile. Each tip is a single sentence.
 */
export function buildSpendingCoachPrompt(input: SpendingCoachInput): ChatPrompt {
  const budgetLine = input.monthlyBudget
    ? `Monthly budget: ${input.monthlyBudget}.`
    : "No monthly budget set.";

  const categoriesBlock = input.topCategories
    .map((c) => `${c.name}: ${c.spend}`)
    .join(", ");

  const flags = [
    input.hasRecentPriceIncrease && "one or more subscriptions recently had a price increase",
    input.hasUnusualCharge && "an unusual or unexpectedly large charge was detected this period",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    system: `You are a friendly personal finance coach inside a budgeting app.

Rules:
- Write 2–3 tips, each on its own line, each a single sentence (max 25 words).
- Base tips only on the data provided. Do not invent numbers or merchants.
- Be specific and actionable (e.g. "Consider cancelling X" rather than "Reduce subscriptions").
- Do not use bullet symbols, numbers, or any markdown formatting.
- Avoid generic platitudes. Each tip should be directly tied to the user's data.
- Do not give investment, tax, or legal advice.`,

    user: `Spending snapshot:
${budgetLine}
Month-to-date: ${input.mtdSpend} (projected end-of-month: ${input.projectedSpend}).
Top categories: ${categoriesBlock || "none"}.
Active subscriptions: ${input.subscriptionCount} (~${input.subscriptionAnnualizedTotal}/yr combined).
${flags ? `Flags: ${flags}.` : ""}

Write 2–3 personalized money-saving tips.`,
  };
}
