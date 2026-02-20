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

function decodeSetupToken(setupToken: string): string {
  const decoder = new TextDecoder();
  const decoded = decoder.decode(fromBase64(setupToken));
  const claimUrl = decoded.trim();

  if (!/^https?:\/\//i.test(claimUrl)) {
    throw new Error("Invalid setup token.");
  }

  return claimUrl;
}

const SIMPLEFIN_ALLOWED_HOSTS = [
  "bridge.simplefin.org",
  "beta-bridge.simplefin.org",
];

function assertSafeSimplefinUrl(rawUrl: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid ${label}.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use https.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!SIMPLEFIN_ALLOWED_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`))) {
    throw new Error(`${label} host is not allowed.`);
  }

  return parsed;
}

async function fetchWithTimeoutAndRetry(
  input: string,
  init: RequestInit,
  options: { timeoutMs: number; retries: number },
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if ((response.status === 429 || response.status >= 500) && attempt < options.retries) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt >= options.retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Network request failed.");
}

// SimpleFIN protocol: decode setup token to claim URL, POST claim URL with Content-Length: 0.
export async function exchangeSetupToken(setupToken: string): Promise<string> {
  const claimUrl = decodeSetupToken(setupToken);
  const safeClaimUrl = assertSafeSimplefinUrl(claimUrl, "SimpleFIN claim URL");

  const response = await fetchWithTimeoutAndRetry(safeClaimUrl.toString(), {
    method: "POST",
    headers: { "Content-Length": "0" },
  }, { timeoutMs: 8_000, retries: 2 });

  if (!response.ok) {
    throw new Error("Failed to exchange setup token.");
  }

  const accessUrl = (await response.text()).trim();
  if (!/^https?:\/\//i.test(accessUrl)) {
    throw new Error("SimpleFIN returned an invalid access URL.");
  }

  assertSafeSimplefinUrl(accessUrl, "SimpleFIN access URL");

  return accessUrl;
}

export type FetchAccountsOptions = {
  startDate?: string | number;
  endDate?: string | number;
  pending?: boolean;
};

export async function fetchAccounts(accessUrl: string, options: FetchAccountsOptions = {}): Promise<unknown> {
  const safeAccessUrl = assertSafeSimplefinUrl(accessUrl, "SimpleFIN access URL");
  const normalizedAccessUrl = safeAccessUrl.toString().replace(/\/+$/, "");
  const url = new URL(`${normalizedAccessUrl}/accounts`);

  if (options.startDate) {
    url.searchParams.set("start-date", String(options.startDate));
  }
  if (options.endDate) {
    url.searchParams.set("end-date", String(options.endDate));
  }
  if (options.pending) {
    url.searchParams.set("pending", "1");
  }

  const response = await fetchWithTimeoutAndRetry(url.toString(), { method: "GET" }, {
    timeoutMs: 8_000,
    retries: 2,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch accounts.");
  }

  return response.json();
}
