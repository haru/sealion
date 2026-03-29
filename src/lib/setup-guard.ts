import { NextRequest, NextResponse } from "next/server";

/**
 * Paths that require the setup-status check. Any request whose pathname does
 * not start with one of these prefixes (or equal one of these exact values) is
 * passed through without contacting the database, avoiding unnecessary latency
 * and DB load on every static asset or unrelated request.
 */
const GUARDED_PATH_PREFIXES = ["/", "/login", "/signup", "/setup", "/settings", "/admin"];

/**
 * Returns true when the given pathname is one that the setup guard must
 * evaluate. Skips API routes, Next.js internals, and static assets.
 *
 * @param pathname - The URL pathname of the incoming request.
 * @returns `true` if the guard should fetch setup-status for this path.
 */
function isGuardedPath(pathname: string): boolean {
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return false;
  }
  // Skip paths that look like static files (contain a dot after the last slash)
  const lastSegment = pathname.split("/").pop() ?? "";
  if (lastSegment.includes(".")) {
    return false;
  }
  return GUARDED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

/**
 * Checks whether first-time admin setup is required and returns a redirect
 * response when the current path should be redirected.
 *
 * Rules:
 * - `/api/*`, `/_next/*`, and static asset paths are always skipped (returns `null`).
 * - Paths outside the known guarded set are skipped to avoid redundant DB calls.
 * - When the `setup-status` API reports `needsSetup: true`, all guarded paths
 *   except `/setup` are redirected to `/setup`.
 * - When `needsSetup: false`, accessing `/setup` redirects to `/login`.
 * - On any fetch error (network failure, 5xx, …), returns `null` so the
 *   request proceeds normally — a DB outage must not lock users out.
 *
 * @param req - The incoming Next.js middleware request.
 * @returns A redirect `NextResponse` when a redirect is required, or `null`
 *   to let the request continue through the normal middleware chain.
 */
export async function setupGuard(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;

  if (!isGuardedPath(pathname)) {
    return null;
  }

  let needsSetup: boolean;
  try {
    const url = new URL("/api/auth/setup-status", req.nextUrl.origin);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    needsSetup = json?.data?.needsSetup === true;
  } catch {
    // Fail-safe: on any error, do not redirect (FR-011)
    return null;
  }

  if (needsSetup && pathname !== "/setup") {
    return NextResponse.redirect(new URL("/setup", req.nextUrl.origin), 307);
  }

  if (!needsSetup && pathname === "/setup") {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin), 307);
  }

  return null;
}
