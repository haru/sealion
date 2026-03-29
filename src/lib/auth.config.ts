import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextRequest } from "next/server";
import { setupGuard } from "@/lib/setup-guard";

// Lightweight config for Edge runtime (middleware) — no Prisma
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [
    // Credentials provider must be listed here for middleware to recognize the strategy
    Credentials({}),
  ],
  callbacks: {
    async authorized({ auth, request }) {
      const { nextUrl } = request;
      const isAuthenticated = !!auth?.user;

      // Check first-time setup before any auth logic so unauthenticated users
      // visiting protected routes are sent directly to /setup (not /login first).
      const setupRedirect = await setupGuard(request as NextRequest);
      if (setupRedirect) return setupRedirect;

      const isProtected =
        nextUrl.pathname.startsWith("/settings") ||
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/admin");
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/signup") ||
        nextUrl.pathname.startsWith("/setup");

      if (isProtected && !isAuthenticated) return false;
      if (isAuthPage && isAuthenticated) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; email?: string | null; role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = (token.id as string | undefined) ?? "";
        session.user.role = (token.role as string | undefined) ?? "USER";
      }
      return session;
    },
  },
};
