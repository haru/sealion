import { HttpProxyAgent } from "hpagent";
import { HttpsProxyAgent } from "hpagent";

/**
 * Axios-compatible proxy agent configuration to be spread into `axios.create()`.
 * Empty object (`{}`) when no proxy is configured — a safe no-op spread.
 *
 * `proxy: false` is included when agents are configured to prevent Axios from
 * also applying its own built-in proxy handling (which reads the same env vars
 * and would override the hpagent CONNECT-tunnel agents with plain HTTP forwarding).
 */
export type ProxyAgentConfig = {
  httpAgent?: InstanceType<typeof HttpProxyAgent>;
  httpsAgent?: InstanceType<typeof HttpsProxyAgent>;
  proxy?: false;
};

/**
 * Reads the proxy URL for a given scheme from environment variables.
 * Lowercase takes precedence over uppercase (POSIX/curl convention).
 * @param scheme - `'http'` or `'https'`
 * @returns The proxy URL string, or `null` when no env var is set.
 */
function getProxyUrl(scheme: "http" | "https"): string | null {
  if (scheme === "https") {
    return process.env.https_proxy ?? process.env.HTTPS_PROXY ?? null;
  }
  return process.env.http_proxy ?? process.env.HTTP_PROXY ?? null;
}

/**
 * Splits and trims the `no_proxy` / `NO_PROXY` environment variable.
 * @returns Array of no-proxy entries, or empty array when unset.
 */
function parseNoProxyList(): string[] {
  const raw = process.env.no_proxy ?? process.env.NO_PROXY ?? null;
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Checks whether a target hostname (and optional port) should bypass the proxy.
 * Matching rules (case-insensitive):
 * 1. `*` — bypass all hosts.
 * 2. `.example.com` — domain-suffix match (subdomain of example.com).
 * 3. `example.com` — exact hostname match.
 * 4. `example.com:8080` — host + port match.
 * @param hostname - The target hostname to check.
 * @param port - Optional target port number.
 * @returns `true` when the host matches a `no_proxy` entry.
 */
function isNoProxy(hostname: string, port?: number): boolean {
  const entries = parseNoProxyList();
  const lowerHost = hostname.toLowerCase();

  for (const entry of entries) {
    const lowerEntry = entry.toLowerCase();

    if (lowerEntry === "*") return true;

    // Port-specific entry: "example.com:8080"
    if (lowerEntry.includes(":")) {
      const colonIdx = lowerEntry.lastIndexOf(":");
      const entryHost = lowerEntry.slice(0, colonIdx);
      const entryPort = parseInt(lowerEntry.slice(colonIdx + 1), 10);
      if (lowerHost === entryHost && port === entryPort) return true;
      continue;
    }

    // Domain-suffix match: ".example.com"
    if (lowerEntry.startsWith(".")) {
      if (lowerHost.endsWith(lowerEntry)) return true;
      continue;
    }

    // Exact match
    if (lowerHost === lowerEntry) return true;
  }

  return false;
}

/**
 * Replaces the username and password in a proxy URL with `***` for safe logging.
 * Parses the URL with `new URL()` so that only actual credentials in the authority
 * section are masked — `@` characters in the path or query are left untouched.
 * @param url - The proxy URL string, potentially containing credentials.
 * @returns The URL with credentials masked, or the original string if no credentials
 *   are present or the string cannot be parsed as an absolute URL.
 */
function maskCredentials(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) {
      return url;
    }
    if (parsed.username) {
      parsed.username = "***";
    }
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    // If the URL constructor cannot parse the input, return the original string unchanged.
    return url;
  }
}

/**
 * Builds an axios-compatible proxy agent configuration object by reading standard
 * proxy environment variables (`http_proxy`, `https_proxy` and uppercase equivalents).
 *
 * Returns `{}` (safe no-op spread) when:
 * - No proxy environment variables are set.
 * - The target host is excluded via `no_proxy` / `NO_PROXY`.
 * - The proxy URL is malformed (logs a warning instead of throwing).
 *
 * @param baseUrl - The base URL of the external service (e.g. `https://api.github.com`).
 *   Used to determine scheme and extract hostname for `no_proxy` matching.
 * @returns `ProxyAgentConfig` — either `{ httpAgent, httpsAgent }` or `{}`.
 * @remarks
 *   When the target scheme is `https` and `https_proxy` / `HTTPS_PROXY` is unset,
 *   the function falls back to `http_proxy` / `HTTP_PROXY`. This matches curl behaviour
 *   but means that setting only `http_proxy` also proxies HTTPS traffic.
 *
 *   The reverse fallback (HTTP target falling back to `https_proxy`) is intentionally
 *   NOT performed — `https_proxy` must not silently proxy plain HTTP traffic.
 */
export function buildAxiosProxyConfig(baseUrl: string): ProxyAgentConfig {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    console.warn("[proxy] Malformed baseUrl — proxy disabled:", baseUrl);
    return {};
  }

  const scheme = parsed.protocol === "https:" ? "https" : "http";
  const hostname = parsed.hostname;
  const port = parsed.port ? parseInt(parsed.port, 10) : undefined;

  if (isNoProxy(hostname, port)) return {};

  // HTTPS targets fall back to http_proxy when https_proxy is unset (curl convention).
  // HTTP targets do NOT fall back to https_proxy — that direction is non-standard.
  const proxyUrl =
    scheme === "https"
      ? (getProxyUrl("https") ?? getProxyUrl("http"))
      : getProxyUrl("http");
  if (!proxyUrl) return {};

  // Validate the proxy URL: must be a valid http/https URL with a hostname
  try {
    const proxyParsed = new URL(proxyUrl);
    if (!["http:", "https:"].includes(proxyParsed.protocol) || !proxyParsed.hostname) {
      throw new Error(`Invalid proxy URL protocol or missing hostname: ${maskCredentials(proxyUrl)}`);
    }
  } catch {
    console.warn("[proxy] Malformed proxy URL — proxy disabled:", maskCredentials(proxyUrl));
    return {};
  }

  try {
    const httpAgent = new HttpProxyAgent({ proxy: proxyUrl });
    const httpsAgent = new HttpsProxyAgent({ proxy: proxyUrl });
    // proxy: false disables Axios's built-in proxy handling, which would otherwise
    // read the same env vars and override our hpagent CONNECT-tunnel agents with
    // plain HTTP forwarding (sending GET https://... instead of CONNECT).
    return { httpAgent, httpsAgent, proxy: false };
  } catch {
    console.warn("[proxy] Failed to construct proxy agents:", maskCredentials(proxyUrl));
    return {};
  }
}

/**
 * Logs the current proxy configuration to `console.info`.
 * Intended to be called once at server startup from `src/instrumentation.ts`.
 * Masks any credentials found in proxy URLs before logging.
 */
export function logProxyConfig(): void {
  const httpsProxy = process.env.https_proxy ?? process.env.HTTPS_PROXY ?? null;
  const httpProxy = process.env.http_proxy ?? process.env.HTTP_PROXY ?? null;
  const noProxy = process.env.no_proxy ?? process.env.NO_PROXY ?? null;

  if (!httpsProxy && !httpProxy) {
    console.info("[proxy] No proxy environment variables detected. Direct connections will be used.");
    return;
  }

  if (httpsProxy) {
    const key = process.env.https_proxy ? "https_proxy" : "HTTPS_PROXY";
    console.info(`[proxy] ${key}=${maskCredentials(httpsProxy)}`);
  }
  if (httpProxy) {
    const key = process.env.http_proxy ? "http_proxy" : "HTTP_PROXY";
    console.info(`[proxy] ${key}=${maskCredentials(httpProxy)}`);
  }
  if (noProxy) {
    const key = process.env.no_proxy ? "no_proxy" : "NO_PROXY";
    console.info(`[proxy] ${key}=${noProxy}`);
  }
  console.info("[proxy] Proxy active for external providers.");
}
