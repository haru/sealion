import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth(function middleware(req: NextRequest & { auth: { user?: unknown } | null }) {
  const { pathname } = req.nextUrl;

  // Admin API routes: require ADMIN role
  if (pathname.startsWith("/api/admin")) {
    const role = (req.auth as { user?: { role?: string } } | null)?.user?.role;
    if (role !== "ADMIN") {
      return NextResponse.json({ data: null, error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Skip auth processing for all other API routes
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
