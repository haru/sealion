import { NextRequest, NextResponse } from "next/server";

/**
 * Checks whether first-time admin setup is required and returns a redirect
 * response when the current path should be redirected.
 *
 * Rules:
 * - `/api/*` paths are always skipped (returns `null`).
 * - When the `setup-status` API reports `needsSetup: true`, all paths except
 *   `/setup` are redirected to `/setup`.
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

  // Never intercept API routes
  if (pathname.startsWith("/api/")) {
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
