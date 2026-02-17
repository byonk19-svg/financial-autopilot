import {
  decodeByteaToString,
  decryptString,
  encodeByteaFromString,
  encryptString,
  parseSerializedEncryptedPayload,
  serializeEncryptedPayload,
} from "./crypto.ts";

const TEST_SECRET = "abcdefghijklmnopqrstuvwxyz123456";

Deno.test("encrypt/decrypt roundtrip succeeds", async () => {
  const plaintext = "https://bridge.simplefin.org/access/abc123";
  const encrypted = await encryptString(plaintext, TEST_SECRET);
  const decrypted = await decryptString(encrypted, TEST_SECRET);
  if (decrypted !== plaintext) {
    throw new Error("Decrypted plaintext does not match original plaintext.");
  }
});

Deno.test("token_enc bytea serialization roundtrip succeeds", async () => {
  const plaintext = "https://bridge.simplefin.org/access/def456";
  const encrypted = await encryptString(plaintext, TEST_SECRET);

  const serialized = serializeEncryptedPayload(encrypted);
  const bytea = encodeByteaFromString(serialized);
  const restoredSerialized = decodeByteaToString(bytea);
  const restoredPayload = parseSerializedEncryptedPayload(restoredSerialized);
  const decrypted = await decryptString(restoredPayload, TEST_SECRET);

  if (decrypted !== plaintext) {
    throw new Error("Bytea envelope roundtrip failed.");
  }
});

Deno.test("legacy iv:ciphertext envelope is still parseable", async () => {
  const plaintext = "https://bridge.simplefin.org/access/ghi789";
  const encrypted = await encryptString(plaintext, TEST_SECRET);

  const legacyEnvelope = `${encrypted.ivB64}:${encrypted.ciphertextB64}`;
  const restoredPayload = parseSerializedEncryptedPayload(legacyEnvelope);
  const decrypted = await decryptString(restoredPayload, TEST_SECRET);

  if (decrypted !== plaintext) {
    throw new Error("Legacy envelope parse failed.");
  }
});

