const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedPayload = {
  ciphertextB64: string;
  ivB64: string;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const output = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }

  return output;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex input length.");
  }
  const output = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const parsed = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(parsed)) {
      throw new Error("Invalid hex input data.");
    }
    output[i / 2] = parsed;
  }
  return output;
}

export function encodeByteaFromString(value: string): string {
  return `\\x${bytesToHex(encoder.encode(value))}`;
}

export function decodeByteaToString(value: string): string {
  if (!value || typeof value !== "string") {
    throw new Error("Invalid bytea value.");
  }

  if (!value.startsWith("\\x")) {
    return value;
  }

  const normalized = value.slice(2);
  return decoder.decode(hexToBytes(normalized));
}

export function serializeEncryptedPayload(payload: EncryptedPayload): string {
  return JSON.stringify(payload);
}

export function parseSerializedEncryptedPayload(serialized: string): EncryptedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    const [ivB64, ciphertextB64] = serialized.split(":", 2);
    if (ivB64 && ciphertextB64) {
      return { ivB64, ciphertextB64 };
    }
    throw new Error("Invalid serialized encrypted payload.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid encrypted payload.");
  }

  const record = parsed as Record<string, unknown>;
  const ivB64 = typeof record.ivB64 === "string" ? record.ivB64 : "";
  const ciphertextB64 = typeof record.ciphertextB64 === "string" ? record.ciphertextB64 : "";
  if (!ivB64 || !ciphertextB64) {
    throw new Error("Encrypted payload missing ivB64/ciphertextB64.");
  }

  return { ivB64, ciphertextB64 };
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  // Any non-empty SIMPLEFIN_ENC_KEY length is acceptable here because we always
  // normalize operator input through a SHA-256 digest before importing it as
  // the raw AES-256 key material. Operators should still use a high-entropy
  // secret (32+ random characters recommended) to keep brute-force risk low.
  if (!secret || secret.trim().length === 0) {
    throw new Error("SIMPLEFIN_ENC_KEY is required.");
  }

  const secretDigest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    secretDigest,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(plaintext: string, secret: string): Promise<EncryptedPayload> {
  const key = await importAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = encoder.encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes,
  );

  return {
    ciphertextB64: toBase64(new Uint8Array(encryptedBuffer)),
    ivB64: toBase64(iv),
  };
}

export async function decryptString(
  payload: EncryptedPayload,
  secret: string,
): Promise<string> {
  const key = await importAesKey(secret);
  const iv = fromBase64(payload.ivB64);
  const ciphertext = fromBase64(payload.ciphertextB64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return decoder.decode(decryptedBuffer);
}
