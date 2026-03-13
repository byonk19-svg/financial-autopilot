import { getCorsHeaders } from "../_shared/cors.ts";
import {
  emptySyncRequestOptions,
  parseSyncRequestOptionsBody,
  type SyncRequestOptions,
} from "../_shared/simplefin_sync_options.ts";

export const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-cron-secret";
export const ALLOW_METHODS = "POST, OPTIONS";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req, {
        allowHeaders: ALLOW_HEADERS,
        allowMethods: ALLOW_METHODS,
      }),
      "Content-Type": "application/json",
    },
  });
}

export async function parseSyncRequestOptions(req: Request): Promise<SyncRequestOptions> {
  const contentLength = req.headers.get("content-length");
  if (contentLength === "0") {
    return emptySyncRequestOptions();
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return emptySyncRequestOptions();
  }

  try {
    return parseSyncRequestOptionsBody(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    throw new HttpError(400, message);
  }
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export function isCronRequest(req: Request, cronSecret: string | undefined): boolean {
  if (!cronSecret) {
    return false;
  }

  const providedSecret = req.headers.get("x-cron-secret");
  return Boolean(providedSecret && providedSecret === cronSecret);
}

export function errorInfo(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "unknown_error",
    stack: null,
  };
}
