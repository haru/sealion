import { HttpProxyAgent } from "hpagent";
import { HttpsProxyAgent } from "hpagent";

/**
 * Axios-compatible proxy agent configuration to be spread into `axios.create()`.
 * Empty object (`{}`) when no proxy is configured — a safe no-op spread.
 */
export type ProxyAgentConfig = {
  httpAgent?: InstanceType<typeof HttpProxyAgent>;
  httpsAgent?: InstanceType<typeof HttpsProxyAgent>;
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
 * Replaces the `user:pass@` segment of a URL string with `***:***@` for safe logging.
 * @param url - The proxy URL string, potentially containing credentials.
 * @returns The URL with credentials masked, or the original string if no credentials found.
 */
function maskCredentials(url: string): string {
  return url.replace(/\/\/[^@]*@/, "//" + "***:***@");
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
 */
export function buildAxiosProxyConfig(baseUrl: string): ProxyAgentConfig {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return {};
  }

  const scheme = parsed.protocol === "https:" ? "https" : "http";
  const hostname = parsed.hostname;
  const port = parsed.port ? parseInt(parsed.port, 10) : undefined;

  if (isNoProxy(hostname, port)) return {};

  const proxyUrl = getProxyUrl(scheme) ?? getProxyUrl(scheme === "https" ? "http" : "https");
  if (!proxyUrl) return {};

  // Validate the proxy URL: must be a valid http/https URL with a hostname
  try {
    const parsed = new URL(proxyUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error(`Invalid proxy URL protocol or missing hostname: ${proxyUrl}`);
    }
  } catch (err) {
    console.warn("[proxy] Malformed proxy URL — proxy disabled:", err);
    return {};
  }

  try {
    const httpAgent = new HttpProxyAgent({ proxy: proxyUrl });
    const httpsAgent = new HttpsProxyAgent({ proxy: proxyUrl });
    return { httpAgent, httpsAgent };
  } catch (err) {
    console.warn("[proxy] Failed to construct proxy agents:", err);
    return {};
  }
}

/**
 * Logs the current proxy configuration to `console.log`.
 * Intended to be called once at server startup from `src/instrumentation.ts`.
 * Masks any credentials found in proxy URLs before logging.
 */
export function logProxyConfig(): void {
  const httpsProxy = process.env.https_proxy ?? process.env.HTTPS_PROXY ?? null;
  const httpProxy = process.env.http_proxy ?? process.env.HTTP_PROXY ?? null;
  const noProxy = process.env.no_proxy ?? process.env.NO_PROXY ?? null;

  if (!httpsProxy && !httpProxy) {
    console.log("[proxy] No proxy environment variables detected. Direct connections will be used.");
    return;
  }

  if (httpsProxy) {
    const key = process.env.https_proxy ? "https_proxy" : "HTTPS_PROXY";
    console.log(`[proxy] ${key}=${maskCredentials(httpsProxy)}`);
  }
  if (httpProxy) {
    const key = process.env.http_proxy ? "http_proxy" : "HTTP_PROXY";
    console.log(`[proxy] ${key}=${maskCredentials(httpProxy)}`);
  }
  if (noProxy) {
    const key = process.env.no_proxy ? "no_proxy" : "NO_PROXY";
    console.log(`[proxy] ${key}=${noProxy}`);
  }
  console.log("[proxy] Proxy active for external providers.");
}
