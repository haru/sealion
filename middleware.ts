import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);
const intlMiddleware = createMiddleware(routing);

export default auth(function middleware(req: NextRequest & { auth: { user?: unknown } | null }) {
  const { pathname } = req.nextUrl;

  // Skip API routes (except admin protection below)
  if (pathname.startsWith("/api/")) {
    // Admin API routes: require ADMIN role
    if (pathname.startsWith("/api/admin")) {
      const role = (req.auth as { user?: { role?: string } } | null)?.user?.role;
      if (role !== "ADMIN") {
        return NextResponse.json({ data: null, error: "FORBIDDEN" }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // Apply i18n to all non-API routes
  return intlMiddleware(req as unknown as Parameters<typeof intlMiddleware>[0]);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
