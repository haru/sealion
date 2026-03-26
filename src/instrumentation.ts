/**
 * Next.js instrumentation hook — runs once when the server process starts,
 * before any requests are handled.
 *
 * Proxy logging uses Node.js-only modules (hpagent) and is guarded behind a
 * runtime check so it never runs in the Edge runtime, which does not support
 * Node.js built-ins.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logProxyConfig } = await import("@/lib/proxy");
    logProxyConfig();
  }
}
