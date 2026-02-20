import { describe, expect, it } from "vitest";
import { normalizeMerchantForRecurring } from "./merchant";

describe("normalizeMerchantForRecurring", () => {
  it("maps Comcast/Xfinity variants to COMCAST", () => {
    expect(normalizeMerchantForRecurring("COMCAST XFINITY HOUSTON TX 5521")).toBe("COMCAST");
    expect(normalizeMerchantForRecurring("XFINITY MOBILE AUTOPAY")).toBe("COMCAST");
  });
});
