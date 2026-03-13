import {
  decodeByteaToString,
  decryptString,
  parseSerializedEncryptedPayload,
} from "../_shared/crypto.ts";
import type {
  AccountRow,
  ConnectionRow,
  UserPreference,
} from "./types.ts";
import { HttpError } from "./request.ts";

type AdminClient = {
  from: (table: string) => any;
};

export function getUniqueDecryptSecrets(
  tokenKid: string | null,
  encKey: string,
  keyByKid: Record<string, string>,
): string[] {
  const candidates: string[] = [];
  if (tokenKid && keyByKid[tokenKid]) {
    candidates.push(keyByKid[tokenKid]);
  }
  candidates.push(encKey);
  for (const key of Object.values(keyByKid)) {
    candidates.push(key);
  }
  return [...new Set(candidates.filter((value) => typeof value === "string" && value.length > 0))];
}

export async function decryptAccessUrl(
  connection: ConnectionRow,
  encKey: string,
  keyByKid: Record<string, string>,
): Promise<string> {
  if (!connection.token_enc) {
    throw new Error("No encrypted SimpleFIN token payload available.");
  }

  let payload: { ciphertextB64: string; ivB64: string };
  try {
    const serializedPayload = decodeByteaToString(connection.token_enc);
    payload = parseSerializedEncryptedPayload(serializedPayload);
  } catch {
    throw new Error("Invalid encrypted SimpleFIN token payload.");
  }

  const secrets = getUniqueDecryptSecrets(connection.token_kid, encKey, keyByKid);
  let lastError: unknown = null;

  for (const secret of secrets) {
    try {
      const accessUrl = await decryptString(payload, secret);
      return accessUrl;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unable to decrypt SimpleFIN token payload.");
}

export async function getRawDescriptionDaysMap(
  adminClient: AdminClient,
  userIds: string[],
): Promise<Map<string, UserPreference>> {
  const map = new Map<string, UserPreference>();
  if (userIds.length === 0) {
    return map;
  }

  const { data, error } = await adminClient
    .from("user_preferences")
    .select("user_id, raw_description_days, retention_months")
    .in("user_id", userIds);

  if (error) {
    throw new HttpError(500, "Could not read user preferences.");
  }

  for (const row of data ?? []) {
    const rawDescriptionDays = typeof row.raw_description_days === "number" ? row.raw_description_days : 90;
    const retentionMonths = typeof row.retention_months === "number" ? row.retention_months : 24;
    map.set(row.user_id, { rawDescriptionDays, retentionMonths });
  }

  return map;
}

export async function getTransactionCountForUser(
  adminClient: AdminClient,
  userId: string,
): Promise<number> {
  const { count, error } = await adminClient
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false);

  if (error) {
    throw new HttpError(500, "Could not count transactions.");
  }

  return count ?? 0;
}

export async function upsertAccount(
  adminClient: AdminClient,
  row: Record<string, unknown>,
): Promise<AccountRow> {
  const { data, error } = await adminClient
    .from("accounts")
    .upsert(row, { onConflict: "user_id,provider_account_id" })
    .select("id")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Could not upsert account.");
  }

  return data as AccountRow;
}

export async function upsertTransactions(
  adminClient: AdminClient,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => {
      const { owner: _owner, ...rest } = row;
      return rest;
    });
    const { error } = await adminClient
      .from("transactions")
      .upsert(batch, { onConflict: "account_id,provider_transaction_id" });

    if (error) {
      throw new HttpError(500, "Could not upsert transactions.");
    }
  }
}
