import { describe, expect, it } from "vitest";
import { getUniqueDecryptSecrets } from "./storage.ts";

describe("getUniqueDecryptSecrets", () => {
  it("orders the key-id secret first and de-duplicates secrets", () => {
    expect(
      getUniqueDecryptSecrets("kid-2", "fallback", {
        "kid-1": "fallback",
        "kid-2": "preferred",
      }),
    ).toEqual(["preferred", "fallback"]);
  });
});
