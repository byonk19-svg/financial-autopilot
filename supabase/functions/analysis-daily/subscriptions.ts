import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { classifyRecurring, normalizeMerchantForRecurring, type RecurringKind } from "../_shared/merchant.ts";
import { detectRecurringPattern, type Cadence, type RecurringCharge } from "../_shared/recurring.ts";
import type {
  EnrichedTxRow,
  GroupedRecurring,
  RecurringClassificationRuleRow,
  SubscriptionCandidate,
  SubscriptionClassification,
} from "./types.ts";
import { clamp, expenseAmount, parseDayKey, round2, toNumber, toUtcDayKey } from "./utils.ts";

function addCadenceInterval(day: string, cadence: Exclude<Cadence, "unknown">): string {
  const base = parseDayKey(day);
  if (cadence === "weekly") {
    base.setUTCDate(base.getUTCDate() + 7);
  } else if (cadence === "monthly") {
    base.setUTCMonth(base.getUTCMonth() + 1);
  } else if (cadence === "quarterly") {
    base.setUTCMonth(base.getUTCMonth() + 3);
  } else if (cadence === "yearly") {
    base.setUTCFullYear(base.getUTCFullYear() + 1);
  }
  return base.toISOString().slice(0, 10);
}

function normalizeKindHint(kindHint: string | null): RecurringKind | null {
  if (!kindHint) return null;
  const normalized = kindHint.trim().toLowerCase();
  if (
    normalized === "recurring" ||
    normalized === "subscription" ||
    normalized === "bill" ||
    normalized === "loan" ||
    normalized === "transfer" ||
    normalized === "payroll" ||
    normalized === "discretionary_recurring"
  ) {
    return normalized;
  }
  return null;
}

function toRecurringCharge(tx: EnrichedTxRow): RecurringCharge | null {
  const expense = expenseAmount(tx.amount);
  if (expense > 0) {
    return { day: toUtcDayKey(tx.posted_at), absAmount: expense };
  }

  const signedAmount = toNumber(tx.amount);
  if (signedAmount <= 0) return null;

  const normalizedHint = normalizeKindHint(tx.kind_hint);
  const hasRecurringSignal = tx.forced_pattern_classification !== null ||
    (normalizedHint !== null && normalizedHint !== "payroll");
  if (!hasRecurringSignal) return null;

  return { day: toUtcDayKey(tx.posted_at), absAmount: round2(Math.abs(signedAmount)) };
}

function sumByDay(charges: RecurringCharge[]): RecurringCharge[] {
  const totals = new Map<string, number>();
  for (const charge of charges) {
    totals.set(charge.day, (totals.get(charge.day) ?? 0) + charge.absAmount);
  }
  return [...totals.entries()]
    .map(([day, absAmount]) => ({ day, absAmount: round2(absAmount) }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

function groupRecurringByMerchant(transactions: EnrichedTxRow[]): Map<string, GroupedRecurring> {
  const grouped = new Map<string, GroupedRecurring>();

  for (const tx of transactions) {
    const charge = toRecurringCharge(tx);
    if (!charge) continue;
    const merchantKey = tx.effective_merchant;
    if (!merchantKey || merchantKey === "UNKNOWN") continue;

    const group = grouped.get(merchantKey) ?? { charges: [], kindHint: null, forcedDecisions: [] };
    group.charges.push(charge);
    if (!group.kindHint && tx.kind_hint) {
      group.kindHint = tx.kind_hint;
    }
    if (tx.forced_pattern_classification) {
      group.forcedDecisions.push({
        classification: tx.forced_pattern_classification,
        cadence: tx.forced_pattern_cadence,
        ruleRef: tx.applied_rule_ref,
        explanation: tx.applied_rule_explanation,
        priority: tx.applied_rule_priority ?? 10_000,
      });
    }
    grouped.set(merchantKey, group);
  }

  return grouped;
}

function selectForcedDecisionForCadence(
  group: GroupedRecurring,
  cadence: Cadence | null,
  allowAnyCadence = false,
): {
  classification: SubscriptionClassification;
  ruleRef: string | null;
  explanation: string | null;
} | null {
  const eligible = group.forcedDecisions.filter((decision) =>
    allowAnyCadence || decision.cadence === null || decision.cadence === cadence
  );
  if (eligible.length === 0) return null;

  const counts = new Map<
    string,
    {
      classification: SubscriptionClassification;
      ruleRef: string | null;
      explanation: string | null;
      priority: number;
      count: number;
    }
  >();

  for (const decision of eligible) {
    const key = `${decision.ruleRef ?? "none"}:${decision.classification}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      existing.priority = Math.min(existing.priority, decision.priority);
      counts.set(key, existing);
      continue;
    }
    counts.set(key, {
      classification: decision.classification,
      ruleRef: decision.ruleRef,
      explanation: decision.explanation,
      priority: decision.priority,
      count: 1,
    });
  }

  const ranked = [...counts.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.count !== b.count) return b.count - a.count;
    return (a.ruleRef ?? "").localeCompare(b.ruleRef ?? "");
  });

  const winner = ranked[0];
  return {
    classification: winner.classification,
    ruleRef: winner.ruleRef,
    explanation: winner.explanation,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }
  return sorted[midpoint];
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function cadenceFromMedianDelta(medianDelta: number): Cadence {
  if (medianDelta >= 5 && medianDelta <= 9) return "weekly";
  if (medianDelta >= 25 && medianDelta <= 35) return "monthly";
  if (medianDelta >= 83 && medianDelta <= 97) return "quarterly";
  if (medianDelta >= 351 && medianDelta <= 379) return "yearly";
  if (medianDelta >= 20 && medianDelta <= 45) return "monthly";
  if (medianDelta >= 70 && medianDelta <= 110) return "quarterly";
  if (medianDelta >= 330 && medianDelta <= 400) return "yearly";
  return "unknown";
}

function inferCadenceFromChargeTimeline(charges: RecurringCharge[]): { cadence: Cadence; confidence: number } {
  if (charges.length < 2) return { cadence: "unknown", confidence: 0.4 };
  const deltas: number[] = [];
  for (let i = 1; i < charges.length; i += 1) {
    const prev = parseDayKey(charges[i - 1].day);
    const next = parseDayKey(charges[i].day);
    const diff = Math.round((next.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    if (diff > 0) deltas.push(diff);
  }
  if (deltas.length === 0) return { cadence: "unknown", confidence: 0.4 };

  const medianDelta = median(deltas);
  const cadence = cadenceFromMedianDelta(medianDelta);
  const meanDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const varianceScore = meanDelta > 0 ? 1 - clamp(stddev(deltas) / meanDelta, 0, 1) : 0;
  const base = cadence === "unknown" ? 0.45 : 0.58;
  const confidence = round2(clamp(base + varianceScore * 0.22, 0, 0.85));
  return { cadence, confidence };
}

function kindFromForcedClassification(classification: SubscriptionClassification): RecurringKind {
  if (classification === "subscription") return "subscription";
  if (classification === "bill_loan") return "bill";
  if (classification === "transfer") return "transfer";
  if (classification === "ignore") return "recurring";
  return "recurring";
}

function toSubscriptionClassification(kind: RecurringKind, confidence: number): SubscriptionClassification {
  if (confidence < 0.8) return "needs_review";
  if (kind === "transfer") return "transfer";
  if (kind === "bill" || kind === "loan") return "bill_loan";
  if (kind === "payroll") return "ignore";
  if (kind === "subscription") return "subscription";
  return "needs_review";
}

function buildCandidateFromForcedDecision(
  userId: string,
  merchantKey: string,
  group: GroupedRecurring,
): SubscriptionCandidate | null {
  if (group.forcedDecisions.length === 0) return null;

  const dailyCharges = sumByDay(group.charges);
  if (dailyCharges.length < 2) return null;

  const ordered = [...dailyCharges].sort((a, b) => (a.day < b.day ? -1 : 1));
  const cadenceGuess = inferCadenceFromChargeTimeline(ordered);

  const forcedDecision = selectForcedDecisionForCadence(group, cadenceGuess.cadence) ??
    selectForcedDecisionForCadence(group, cadenceGuess.cadence, true);
  if (!forcedDecision) return null;

  const last = ordered[ordered.length - 1];
  const prev = ordered.length >= 2 ? ordered[ordered.length - 2] : null;
  const kind = kindFromForcedClassification(forcedDecision.classification);
  const fallbackExplanation = forcedDecision.explanation ??
    "Included from a forced recurring classification rule.";

  return {
    user_id: userId,
    merchant_normalized: merchantKey,
    cadence: cadenceGuess.cadence,
    confidence: cadenceGuess.confidence,
    classification: forcedDecision.classification,
    classification_rule_ref: forcedDecision.ruleRef ?? "transaction_rule:forced-recurring",
    classification_explanation: fallbackExplanation,
    kind,
    is_subscription: forcedDecision.classification === "subscription",
    last_amount: round2(last.absAmount),
    prev_amount: prev ? round2(prev.absAmount) : null,
    last_charge_at: last.day,
    next_expected_at: cadenceGuess.cadence === "unknown" ? null : addCadenceInterval(last.day, cadenceGuess.cadence),
    occurrences: ordered.length,
  };
}

function buildCandidateFromDetection(
  userId: string,
  merchantKey: string,
  group: GroupedRecurring,
  detection: ReturnType<typeof detectRecurringPattern>,
): SubscriptionCandidate | null {
  if (!detection) return null;
  if (detection.cadence === "unknown") return null;
  if (detection.filteredCharges.length < 2) return null;

  const ordered = [...detection.filteredCharges].sort((a, b) => (a.day < b.day ? -1 : 1));
  const last = ordered[ordered.length - 1];
  const prev = ordered.length >= 2 ? ordered[ordered.length - 2] : null;
  const classification = classifyRecurring(merchantKey);
  const normalizedHint = normalizeKindHint(group.kindHint);
  const effectiveKind = normalizedHint ?? classification.kind;
  const isSubscription = effectiveKind === "subscription";
  const confidence = round2(clamp(detection.confidence, 0, 1));
  const forcedDecision = selectForcedDecisionForCadence(group, detection.cadence);
  const recurringClassification = forcedDecision?.classification ?? toSubscriptionClassification(effectiveKind, confidence);
  const heuristicExplanation =
    `Auto-classified from recurring ${detection.cadence} pattern (confidence ${confidence.toFixed(2)}, kind ${effectiveKind}).`;

  return {
    user_id: userId,
    merchant_normalized: merchantKey,
    cadence: detection.cadence,
    confidence,
    classification: recurringClassification,
    classification_rule_ref: forcedDecision?.ruleRef ?? "heuristic:recurring-pattern",
    classification_explanation: forcedDecision?.explanation ?? heuristicExplanation,
    kind: effectiveKind,
    is_subscription: isSubscription,
    last_amount: round2(last.absAmount),
    prev_amount: prev ? round2(prev.absAmount) : null,
    last_charge_at: last.day,
    next_expected_at: addCadenceInterval(last.day, detection.cadence),
    occurrences: detection.occurrences,
  };
}

export function buildSubscriptionCandidates(
  userId: string,
  tx180: EnrichedTxRow[],
  tx730: EnrichedTxRow[],
): SubscriptionCandidate[] {
  const candidates: SubscriptionCandidate[] = [];
  const seen = new Set<string>();
  const merchantsWithCandidate = new Set<string>();

  const grouped180 = groupRecurringByMerchant(tx180);
  for (const [merchantKey, group] of grouped180.entries()) {
    const detection = detectRecurringPattern(sumByDay(group.charges), ["weekly", "monthly", "quarterly"]);
    const candidate = buildCandidateFromDetection(userId, merchantKey, group, detection);
    if (!candidate) continue;
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merchantsWithCandidate.add(candidate.merchant_normalized);
    candidates.push(candidate);
  }

  const grouped730 = groupRecurringByMerchant(tx730);
  for (const [merchantKey, group] of grouped730.entries()) {
    const detection = detectRecurringPattern(sumByDay(group.charges), ["yearly"]);
    const candidate = buildCandidateFromDetection(userId, merchantKey, group, detection);
    if (!candidate) continue;
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merchantsWithCandidate.add(candidate.merchant_normalized);
    candidates.push(candidate);
  }

  for (const [merchantKey, group] of grouped730.entries()) {
    if (merchantsWithCandidate.has(merchantKey)) continue;
    const fallbackCandidate = buildCandidateFromForcedDecision(userId, merchantKey, group);
    if (!fallbackCandidate) continue;
    const key = `${fallbackCandidate.merchant_normalized}:${fallbackCandidate.cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merchantsWithCandidate.add(fallbackCandidate.merchant_normalized);
    candidates.push(fallbackCandidate);
  }

  return candidates;
}

function parsePriceHistory(input: unknown): Array<{ amount: number; charged_at: string }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const amount = typeof row.amount === "number"
        ? row.amount
        : typeof row.amount === "string"
        ? Number.parseFloat(row.amount)
        : NaN;
      const chargedAt = typeof row.charged_at === "string" ? row.charged_at : "";
      if (!Number.isFinite(amount) || !chargedAt) return null;
      return { amount: round2(amount), charged_at: chargedAt };
    })
    .filter((value): value is { amount: number; charged_at: string } => value !== null);
}

function upsertPriceHistory(
  current: Array<{ amount: number; charged_at: string }>,
  amount: number | null,
  chargedAt: string | null,
): Array<{ amount: number; charged_at: string }> {
  if (amount === null || !chargedAt) return current.slice(-12);
  const last = current[current.length - 1];
  if (!last || Math.abs(last.amount - amount) > 0.009) {
    return [...current, { amount: round2(amount), charged_at: chargedAt }].slice(-12);
  }
  return current.slice(-12);
}

function rangeWidth(rule: RecurringClassificationRuleRow): number {
  const min = rule.min_amount === null ? null : toNumber(rule.min_amount);
  const max = rule.max_amount === null ? null : toNumber(rule.max_amount);
  if (min === null || max === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, max - min);
}

function ruleSpecificity(rule: RecurringClassificationRuleRow): number {
  let score = 0;
  if (rule.cadence !== null) score += 4;
  if (rule.min_amount !== null) score += 2;
  if (rule.max_amount !== null) score += 2;
  return score;
}

function ruleMatchesCandidate(rule: RecurringClassificationRuleRow, candidate: SubscriptionCandidate): boolean {
  if (rule.merchant_normalized !== candidate.merchant_normalized) return false;
  if (rule.cadence !== null && rule.cadence !== candidate.cadence) return false;

  const amount = candidate.last_amount;
  if (rule.min_amount !== null) {
    if (amount === null) return false;
    if (amount < toNumber(rule.min_amount)) return false;
  }

  if (rule.max_amount !== null) {
    if (amount === null) return false;
    if (amount > toNumber(rule.max_amount)) return false;
  }

  return true;
}

function selectRule(
  rules: RecurringClassificationRuleRow[],
  candidate: SubscriptionCandidate,
): RecurringClassificationRuleRow | null {
  const matches = rules.filter((rule) => ruleMatchesCandidate(rule, candidate));
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const scoreDiff = ruleSpecificity(b) - ruleSpecificity(a);
    if (scoreDiff !== 0) return scoreDiff;

    const widthDiff = rangeWidth(a) - rangeWidth(b);
    if (widthDiff !== 0) return widthDiff;

    // More recently created rules win for same specificity/range.
    if (a.created_at > b.created_at) return -1;
    if (a.created_at < b.created_at) return 1;
    return 0;
  });

  return matches[0];
}

export async function upsertSubscriptions(
  admin: ReturnType<typeof createClient>,
  userId: string,
  candidates: SubscriptionCandidate[],
): Promise<number> {
  if (candidates.length === 0) return 0;

  const merchants = [...new Set(candidates.map((candidate) => candidate.merchant_normalized))];
  const { data: existingRows } = await admin
    .from("subscriptions")
    .select(
      "merchant_normalized, cadence, price_history, classification, user_locked, classification_rule_ref, classification_explanation, is_false_positive, is_active",
    )
    .eq("user_id", userId)
    .in("merchant_normalized", merchants);

  const existingMap = new Map<
    string,
    {
      priceHistory: Array<{ amount: number; charged_at: string }>;
      classification: SubscriptionClassification;
      userLocked: boolean;
      isFalsePositive: boolean;
      isActive: boolean;
      classificationRuleRef: string | null;
      classificationExplanation: string | null;
    }
  >();
  for (const row of existingRows ?? []) {
    const key = `${row.merchant_normalized}:${row.cadence}`;
    const classification = row.classification as SubscriptionClassification | null;
    existingMap.set(key, {
      priceHistory: parsePriceHistory(row.price_history),
      classification: classification ?? "needs_review",
      userLocked: row.user_locked === true,
      isFalsePositive: row.is_false_positive === true,
      isActive: row.is_active !== false,
      classificationRuleRef: typeof row.classification_rule_ref === "string" ? row.classification_rule_ref : null,
      classificationExplanation: typeof row.classification_explanation === "string"
        ? row.classification_explanation
        : null,
    });
  }

  const { data: ruleRows, error: ruleError } = await admin
    .from("recurring_classification_rules")
    .select("id, merchant_normalized, cadence, min_amount, max_amount, classification, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("merchant_normalized", merchants)
    .order("created_at", { ascending: false });

  if (ruleError) throw new Error("Could not read recurring classification rules.");

  const rulesByMerchant = new Map<string, RecurringClassificationRuleRow[]>();
  for (const row of (ruleRows ?? []) as RecurringClassificationRuleRow[]) {
    const list = rulesByMerchant.get(row.merchant_normalized) ?? [];
    list.push(row);
    rulesByMerchant.set(row.merchant_normalized, list);
  }

  const payload = candidates.flatMap((candidate) => {
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    const existing = existingMap.get(key);
    // Respect manual "Mark inactive" decisions across re-runs.
    if (existing && existing.isActive === false) {
      return [];
    }
    if (existing?.isFalsePositive) {
      return [];
    }
    const existingHistory = existing?.priceHistory ?? [];
    const priceHistory = upsertPriceHistory(existingHistory, candidate.last_amount, candidate.last_charge_at);
    const matchingRules = rulesByMerchant.get(candidate.merchant_normalized) ?? [];
    const ruleMatch = selectRule(matchingRules, candidate);
    const nextClassification = ruleMatch?.classification ?? candidate.classification;

    const classification = existing?.userLocked ? existing.classification : nextClassification;
    const classificationRuleRef = existing?.userLocked
      ? existing.classificationRuleRef
      : ruleMatch
      ? `recurring_rule:${ruleMatch.id}`
      : candidate.classification_rule_ref;
    const classificationExplanation = existing?.userLocked
      ? existing.classificationExplanation
      : ruleMatch
      ? `Matched recurring classification rule ${ruleMatch.id} for ${candidate.merchant_normalized}.`
      : candidate.classification_explanation;

    return [{
      ...candidate,
      classification,
      classification_rule_ref: classificationRuleRef,
      classification_explanation: classificationExplanation,
      price_history: priceHistory,
      is_active: true,
      is_subscription: classification === "subscription",
    }];
  });

  const { error } = await admin
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id,merchant_normalized,cadence" });

  if (error) throw new Error("Could not upsert subscriptions.");

  // Deactivate stale alias variants when a canonical merchant+candence row now exists.
  // Example: COMCAST XFINITY HOUSTON -> COMCAST.
  const candidateKeys = new Set(payload.map((row) => `${row.merchant_normalized}:${row.cadence}`));
  const candidateCanonicalCadenceKeys = new Set(
    payload.map((row) => `${normalizeMerchantForRecurring(row.merchant_normalized)}:${row.cadence}`),
  );

  const { data: activeRows, error: activeRowsError } = await admin
    .from("subscriptions")
    .select("id, merchant_normalized, cadence")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (activeRowsError) throw new Error("Could not read active subscriptions for stale cleanup.");

  const staleIds = (activeRows ?? [])
    .filter((row) => {
      const directKey = `${row.merchant_normalized}:${row.cadence}`;
      if (candidateKeys.has(directKey)) return false;
      const canonicalKey = `${normalizeMerchantForRecurring(row.merchant_normalized)}:${row.cadence}`;
      return candidateCanonicalCadenceKeys.has(canonicalKey);
    })
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error: staleCleanupError } = await admin
      .from("subscriptions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .in("id", staleIds);
    if (staleCleanupError) throw new Error("Could not deactivate stale alias subscription rows.");
  }

  return payload.length;
}

export async function filterFalsePositiveCandidates(
  admin: ReturnType<typeof createClient>,
  userId: string,
  candidates: SubscriptionCandidate[],
): Promise<SubscriptionCandidate[]> {
  if (candidates.length === 0) return [];

  const merchants = [...new Set(candidates.map((candidate) => candidate.merchant_normalized))];
  const { data, error } = await admin
    .from("subscriptions")
    .select("merchant_normalized, cadence")
    .eq("user_id", userId)
    .eq("is_false_positive", true)
    .in("merchant_normalized", merchants);

  if (error) {
    throw new Error("Could not read false-positive subscriptions.");
  }

  const falsePositiveKeys = new Set<string>();
  for (const row of data ?? []) {
    falsePositiveKeys.add(`${row.merchant_normalized}:${row.cadence}`);
  }

  return candidates.filter((candidate) => {
    const key = `${candidate.merchant_normalized}:${candidate.cadence}`;
    return !falsePositiveKeys.has(key);
  });
}
