/**
 * Returns a validation error message when baseUrl is enabled, touched, and empty or malformed.
 * Returns `null` when the field is disabled, untouched, or contains a valid URL.
 * @param enabled - Whether the baseUrl field is active (required mode, or optional mode with checkbox on).
 * @param touched - Whether the field has been blurred at least once.
 * @param value - The current baseUrl value.
 * @param errorMsg - The error message to return when validation fails.
 * @returns The error message string, or `null` when the field is valid or should not be validated.
 */
export function getBaseUrlValidationError(
  enabled: boolean,
  touched: boolean,
  value: string,
  errorMsg: string,
): string | null {
  if (!enabled || !touched) { return null; }
  return value && isValidBaseUrl(value) ? null : errorMsg;
}

/**
 * Validates that a URL is an absolute URL with an http or https scheme and a non-empty host.
 * Used to validate optional base URLs for self-hosted / Enterprise provider instances.
 *
 * Security: rejects private/loopback/link-local IP ranges and URLs with embedded credentials
 * to mitigate Server-Side Request Forgery (SSRF). This is a synchronous string-based check;
 * it does NOT perform DNS resolution, so hostnames that resolve to private IPs at runtime are
 * not blocked here. The connection test in the API route handles unreachable hosts.
 *
 * @param url - The URL string to validate.
 * @returns `true` if the URL is a valid, public-looking http/https absolute URL; `false` otherwise.
 */
export function isValidBaseUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) { return false; }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") { return false; }
  if (!parsed.hostname) { return false; }

  // Reject embedded credentials — these are a SSRF/credential-leakage vector.
  if (parsed.username || parsed.password) { return false; }

  // Strip IPv6 brackets before pattern-matching (e.g. "[::1]" → "::1").
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // Reject loopback, private, and link-local addresses (RFC 1122 / RFC 1918 / RFC 3927).
  if (isPrivateHost(host)) { return false; }

  return true;
}

/**
 * Returns `true` when `host` (already lower-cased, brackets stripped) is a loopback,
 * private-range, or link-local address that must not be reached from the server.
 * @param host - Lower-cased hostname or IP address (IPv6 brackets already removed).
 */
function isPrivateHost(host: string): boolean {
  if (host === "localhost") { return true; }
  if (host === "0.0.0.0") { return true; }

  // IPv6 loopback and private ranges.
  if (host === "::1") { return true; }
  if (host.startsWith("::ffff:127.")) { return true; } // IPv4-mapped loopback
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) { return true; } // Unique local (fc00::/7, covers fc.. and fd..)
  if (/^fe[89ab][0-9a-f]:/i.test(host)) { return true; } // Link-local (fe80::/10)

  // IPv4 loopback (127.0.0.0/8).
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) { return true; }

  // IPv4 link-local / APIPA (169.254.0.0/16).
  if (/^169\.254\.\d+\.\d+$/.test(host)) { return true; }

  // RFC 1918 private ranges.
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) { return true; }
  if (/^192\.168\.\d+\.\d+$/.test(host)) { return true; }
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) { return true; }

  return false;
}
