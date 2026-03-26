import { logProxyConfig } from "@/lib/proxy";

/**
 * Next.js instrumentation hook — runs once when the Node.js server process starts,
 * before any requests are handled.
 *
 * Logs the detected proxy configuration to the server console so administrators
 * can verify proxy settings immediately on startup without waiting for the first sync.
 */
export async function register(): Promise<void> {
  logProxyConfig();
}
