const NOISE_TOKENS = new Set([
  "POS",
  "DEBIT",
  "CREDIT",
  "PURCHASE",
  "ONLINE",
  "WEB",
  "WWW",
  "SQ",
  "PAYPAL",
  "VENMO",
  "CASHAPP",
  "AUTH",
  "HOLD",
]);

const STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

export type RecurringKind =
  | "recurring"
  | "subscription"
  | "bill"
  | "loan"
  | "transfer"
  | "payroll"
  | "discretionary_recurring";

export type MerchantAliasRow = {
  id: number;
  pattern: string;
  normalized: string;
  kind_hint: string | null;
  account_id: string | null;
  user_id: string | null;
  match_type: "contains" | "equals" | "regex";
  priority: number;
};

export type MerchantAliasMatcher = MerchantAliasRow & {
  regex: RegExp | null;
  normalizedPattern: string;
};

function aliasMerchant(value: string): string {
  if (value.includes("APPLE COM BILL")) return "APPLE";
  if (value.includes("ITUNES")) return "APPLE";
  if (value.includes("NETFLIX")) return "NETFLIX";
  if (value.includes("SPOTIFY")) return "SPOTIFY";
  if (/\b(COMCAST|XFINITY)\b/.test(value)) return "COMCAST";
  if (value.includes("AMZN") || value.includes("AMAZON MARKETPLACE") || value.includes("AMAZON")) return "AMAZON";
  if (/\bGOOGLE\b.*\bSERVICES?\b/.test(value)) return "GOOGLE";
  return value;
}

function stripTrailingLocation(value: string): string {
  const stateAndCity = /\s{2,}(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?:\s+[A-Z]{2,}){0,3}\s*$/;
  if (stateAndCity.test(value)) {
    return value.replace(stateAndCity, " ");
  }

  const trailingCity = /\s{2,}[A-Z]{3,}(?:\s+[A-Z]{3,}){0,2}\s*$/;
  if (trailingCity.test(value)) {
    return value.replace(trailingCity, " ");
  }

  return value;
}

export function normalizeMerchantForRecurring(input: string): string {
  if (!input || !input.trim()) return "UNKNOWN";

  let normalized = input.toUpperCase();
  normalized = normalized.replace(/[0-9]/g, " ");
  normalized = normalized.replace(/[^A-Z\s]/g, " ");
  normalized = stripTrailingLocation(normalized);

  const filteredTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !NOISE_TOKENS.has(token))
    .filter((token) => !(token.length === 2 && STATE_CODES.has(token)));

  normalized = filteredTokens.join(" ").trim();
  normalized = aliasMerchant(normalized);
  normalized = normalized.replace(/\s+/g, " ").trim();

  if (!normalized) return "UNKNOWN";

  const short = normalized.split(" ").slice(0, 3).join(" ");
  return short.slice(0, 32);
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string, needles: string[]): boolean {
  const norm = normalizeForMatch(value);
  return needles.some((needle) => {
    const key = normalizeForMatch(needle.replace(/\*/g, " "));
    return key.length > 0 && norm.includes(key);
  });
}

function wildcardPatternToRegex(pattern: string, mode: "contains" | "equals"): RegExp | null {
  const normalizedPattern = pattern
    .toLowerCase()
    .replace(/[^a-z0-9*\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedPattern) return null;

  const escaped = normalizedPattern
    .split("*")
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
    .replace(/\s+/g, "\\s+");

  const source = mode === "equals" ? `^${escaped}$` : escaped;
  return new RegExp(source, "i");
}

function regexFromAlias(row: MerchantAliasRow): RegExp | null {
  if (row.match_type === "regex") {
    try {
      return new RegExp(row.pattern, "i");
    } catch {
      return null;
    }
  }

  return wildcardPatternToRegex(row.pattern, row.match_type);
}

export function compileMerchantAliases(rows: MerchantAliasRow[]): MerchantAliasMatcher[] {
  return rows
    .map((row) => {
      const regex = regexFromAlias(row);
      const normalizedPattern = normalizeForMatch(row.pattern.replace(/\*/g, " "));
      return {
        id: row.id,
        pattern: row.pattern,
        normalized: row.normalized,
        kind_hint: row.kind_hint,
        account_id: row.account_id,
        user_id: row.user_id,
        match_type: row.match_type,
        priority: row.priority,
        regex,
        normalizedPattern,
      };
    })
    .filter((row): row is MerchantAliasMatcher => row !== null && (row.regex !== null || row.normalizedPattern.length > 0));
}

export function findMerchantAlias(
  inputs: Array<string | null | undefined>,
  aliases: MerchantAliasMatcher[],
  accountId: string | null,
): MerchantAliasMatcher | null {
  if (aliases.length === 0) return null;

  const haystack = normalizeForMatch(inputs.filter(Boolean).join(" "));
  if (!haystack) return null;

  for (const alias of aliases) {
    if (alias.account_id !== null && alias.account_id !== accountId) {
      continue;
    }

    if (alias.regex && alias.regex.test(haystack)) {
      return alias;
    }

    if (!alias.regex && alias.match_type === "contains" && alias.normalizedPattern) {
      if (haystack.includes(alias.normalizedPattern)) return alias;
    }
  }

  return null;
}

export function classifyRecurring(merchantNorm: string): { kind: RecurringKind; is_subscription: boolean } {
  const m = normalizeForMatch(merchantNorm);

  const subscription = [
    "netflix",
    "hulu",
    "disney",
    "spotify",
    "apple",
    "apple.com/bill",
    "icloud",
    "app store",
    "google *services",
    "youtube",
    "prime",
    "audible",
    "nintendo",
    "xbox",
    "playstation",
    "adobe",
    "microsoft",
    "dropbox",
    "canva",
    "patreon",
    "substack",
    "max",
    "paramount",
    "nytimes",
    "new york times",
  ];

  const bills = [
    "comcast",
    "xfinity",
    "att",
    "verizon",
    "tmobile",
    "electric",
    "water",
    "gas",
    "trash",
    "internet",
    "insurance",
    "state farm",
    "geico",
    "progressive",
  ];

  const loans = ["loan", "citizensone", "affirm", "carecredit", "nelnet", "navient", "mortgage"];

  const transfers = [
    "transfer",
    "xfer",
    "ach",
    "zelle",
    "venmo",
    "cash app",
    "payment thank you",
    "type inst xfer",
    "crd type",
    "autopay",
    "citicard",
    "betterment",
    "sec a",
    "investment",
    "contribution",
  ];

  const discretionary = [
    "whataburger",
    "chipotle",
    "starbucks",
    "mcdonald",
    "vending",
    "canteen",
    "ctlp canteen",
    "taco",
    "burger",
    "restaurant",
    "cafe",
    "market troy",
    "market",
  ];

  if (includesAny(m, transfers)) return { kind: "transfer", is_subscription: false };
  if (includesAny(m, loans)) return { kind: "loan", is_subscription: false };
  if (includesAny(m, bills)) return { kind: "bill", is_subscription: false };
  if (includesAny(m, subscription)) return { kind: "subscription", is_subscription: true };
  if (includesAny(m, discretionary)) return { kind: "discretionary_recurring", is_subscription: false };

  return { kind: "recurring", is_subscription: false };
}

export function classifyRecurringKind(merchantKey: string): { kind: RecurringKind; isSubscription: boolean } {
  const classified = classifyRecurring(merchantKey);
  return { kind: classified.kind, isSubscription: classified.is_subscription };
}
