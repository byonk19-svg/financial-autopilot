import { normalizeMerchantForRecurring } from "./merchant.ts";

Deno.test("normalizeMerchantForRecurring maps Apple aliases", () => {
  const input = "APPLE.COM/BILL CA 12345";
  const normalized = normalizeMerchantForRecurring(input);
  if (normalized !== "APPLE") {
    throw new Error(`Expected APPLE, got ${normalized}`);
  }
});

Deno.test("normalizeMerchantForRecurring maps Amazon aliases", () => {
  const input = "AMZN Mktp US*2A4BC 9988";
  const normalized = normalizeMerchantForRecurring(input);
  if (normalized !== "AMAZON") {
    throw new Error(`Expected AMAZON, got ${normalized}`);
  }
});

Deno.test("normalizeMerchantForRecurring strips payment noise and location", () => {
  const input = "POS PURCHASE NETFLIX COM LOS GATOS CA";
  const normalized = normalizeMerchantForRecurring(input);
  if (normalized !== "NETFLIX") {
    throw new Error(`Expected NETFLIX, got ${normalized}`);
  }
});

Deno.test("normalizeMerchantForRecurring returns UNKNOWN for blank", () => {
  const input = "   ";
  const normalized = normalizeMerchantForRecurring(input);
  if (normalized !== "UNKNOWN") {
    throw new Error(`Expected UNKNOWN, got ${normalized}`);
  }
});

