type CorsConfig = {
  allowHeaders?: string;
  allowMethods?: string;
};

const DEFAULT_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const DEFAULT_ALLOW_METHODS = "GET, POST, OPTIONS";

function parseAllowedOrigins(raw: string): Set<string> {
  const origins = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return new Set(origins);
}

export function getCorsHeaders(request: Request, config: CorsConfig = {}): Record<string, string> {
  const allowHeaders = config.allowHeaders ?? DEFAULT_ALLOW_HEADERS;
  const allowMethods = config.allowMethods ?? DEFAULT_ALLOW_METHODS;

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": allowMethods,
  };

  const configuredOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (!configuredOrigins?.trim()) {
    // Development fallback to keep local workflows simple when not configured.
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) {
    return headers;
  }

  const allowedOrigins = parseAllowedOrigins(configuredOrigins);
  if (!allowedOrigins.has(requestOrigin.toLowerCase())) {
    return headers;
  }

  headers["Access-Control-Allow-Origin"] = requestOrigin;
  headers["Vary"] = "Origin";
  return headers;
}
