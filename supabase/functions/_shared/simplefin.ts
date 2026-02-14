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

// SimpleFIN protocol: decode setup token to claim URL, POST claim URL with Content-Length: 0.
export async function exchangeSetupToken(setupToken: string): Promise<string> {
  const claimUrl = decodeSetupToken(setupToken);

  const response = await fetch(claimUrl, {
    method: "POST",
    headers: { "Content-Length": "0" },
  });

  if (!response.ok) {
    throw new Error("Failed to exchange setup token.");
  }

  const accessUrl = (await response.text()).trim();
  if (!/^https?:\/\//i.test(accessUrl)) {
    throw new Error("SimpleFIN returned an invalid access URL.");
  }

  return accessUrl;
}

export type FetchAccountsOptions = {
  startDate?: string | number;
  endDate?: string | number;
  pending?: boolean;
};

export async function fetchAccounts(accessUrl: string, options: FetchAccountsOptions = {}): Promise<unknown> {
  const normalizedAccessUrl = accessUrl.replace(/\/+$/, "");
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

  const response = await fetch(url.toString(), { method: "GET" });

  if (!response.ok) {
    throw new Error("Failed to fetch accounts.");
  }

  return response.json();
}
