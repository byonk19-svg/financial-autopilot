type CorsConfig = {
  allowHeaders?: string;
  allowMethods?: string;
};

const DEFAULT_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const DEFAULT_ALLOW_METHODS = "GET, POST, OPTIONS";
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isDevelopmentEnvironment(): boolean {
  const runtimeEnv = (Deno.env.get("DENO_ENV") ?? Deno.env.get("ENVIRONMENT") ?? "").toLowerCase();
  return runtimeEnv === "dev" || runtimeEnv === "development" || runtimeEnv === "local";
}

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
  const requestOrigin = request.headers.get("Origin");

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": allowMethods,
  };

  const configuredOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (!configuredOrigins?.trim()) {
    // Keep local workflows simple when ALLOWED_ORIGINS isn't configured, but avoid
    // permitting all origins in non-development environments.
    if (isDevelopmentEnvironment()) {
      headers["Access-Control-Allow-Origin"] = "*";
      return headers;
    }

    if (requestOrigin && LOCAL_ORIGIN_PATTERN.test(requestOrigin)) {
      headers["Access-Control-Allow-Origin"] = requestOrigin;
      headers["Vary"] = "Origin";
    }
    return headers;
  }

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
