/**
 * Auth.js v5 runtime entry point. Builds the providers list on every request from
 * the DB-backed `AuthProvider` registry, layered on top of the static Credentials provider.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";

import { getSessionTimeoutMinutes } from "@/lib/auth/auth-settings";
import { authConfig } from "@/lib/auth/auth.config";
import {
  evaluateSession,
  isSessionActivityUpdate,
  resolveTimeClaims,
} from "@/lib/auth/session-validity";
import { prisma } from "@/lib/db/db";
import {
  getAuthProviderMetadata,
  listEnabled,
} from "@/services/auth-provider";
import { handleExternalSignIn } from "@/services/auth-provider/account-linking";

/**
 * Loads what session validation needs: the user record and the idle timeout.
 *
 * Errors are logged with context and re-thrown, so validation fails closed (Auth.js ends the
 * session and clears the cookie) while operators can see which step failed.
 *
 * @param userId - The user id from the session token.
 * @returns The user record (`null` when the user no longer exists) and the idle timeout in minutes.
 * @throws Re-throws any database error from the user lookup or the AuthSettings lookup.
 */
async function loadSessionInputs(userId: string) {
  let step: "user-lookup" | "timeout-lookup" = "user-lookup";
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        passwordChangedAt: true,
        sessionsRevokedAt: true,
        useGravatar: true,
      },
    });
    step = "timeout-lookup";
    return { dbUser, timeoutMinutes: await getSessionTimeoutMinutes() };
  } catch (error: unknown) {
    console.error("[auth] session validation failed", { userId, step, error });
    throw error;
  }
}

const credentialsProvider = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) { return null; }

    const user = await prisma.user.findUnique({
      where: { email: credentials.email as string },
    });

    if (!user) { return null; }

    if (user.status === "PENDING") {
      throw new Error("EMAIL_NOT_VERIFIED");
    }
    if (user.status === "SUSPENDED") {
      return null;
    }

    if (!user.passwordHash) {
      // OIDC-only user — no local password. Refuse the credentials path quietly.
      return null;
    }

    const isValid = await bcrypt.compare(
      credentials.password as string,
      user.passwordHash,
    );

    if (!isValid) { return null; }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      useGravatar: user.useGravatar,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const enabled = await listEnabled();
  const externalProviders = enabled.flatMap((record) => {
    const metadata = getAuthProviderMetadata(record.type);
    if (!metadata) {
      console.warn(
        `[auth] No metadata registered for AuthProviderType=${record.type}; skipping ${record.providerId}`,
      );
      return [];
    }
    return [metadata.authJsProviderBuilder(record)];
  });

  return {
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
    providers: [credentialsProvider, ...externalProviders],
    callbacks: {
      ...authConfig.callbacks,
      /**
       * signIn callback — routes external OAuth/OIDC accounts to
       * {@link handleExternalSignIn} for email-verified verification + account
       * auto-link / auto-create. Credentials flow passes through untouched.
       *
       * @param params - Auth.js signIn payload.
       * @returns `true` to allow, `false` to deny generically, or a `/login?error=…` URL.
       */
      async signIn({ user, account, profile }) {
        if (!account || account.type === "credentials") { return true; }
        return handleExternalSignIn({ user, account, profile });
      },
      /**
       * JWT callback — validates the session on every call and refreshes claims from the database
       * (spec 045, ADR 0006).
       *
       * Auth.js overwrites `iat`/`exp` on every encode, so security decisions use the app-owned
       * `authTime` (fixed at sign-in) and `lastActivityAt` claims instead; see {@link resolveTimeClaims}.
       *
       * On every call it loads the user by primary key and runs {@link evaluateSession}. The session is
       * rejected (by returning `null`, never `{}`) when the user is gone or not ACTIVE, when the
       * session predates a password change or an admin revocation, or when it has been idle longer
       * than the configured timeout. A token without a user id is rejected too. `role` and
       * `useGravatar` always come from the database.
       *
       * Only `trigger === "update"` with `{ activity: true }` refreshes `lastActivityAt`, so
       * background refetches and other `update()` calls never extend the idle timeout.
       *
       * The input token is not mutated; a new object is returned.
       *
       * @param token - The current JWT payload.
       * @param user - The authenticated user object (present only on signIn).
       * @param trigger - The event that triggered the callback.
       * @param session - The session update payload (present only on `update` trigger).
       * @returns The updated token, or `null` to end the session.
       * @throws Propagates database errors (user lookup, AuthSettings) after logging them. Auth.js
       *   then treats the session as invalid and clears the cookie, so validation fails closed.
       */
      async jwt({ token, user, trigger, session }) {
        const now = Date.now();
        // Claims of the removed 5-minute password-change cache are dropped.
        const { pwdCheckedAt: _legacyCheckedAt, pwdChangedAt: _legacyChangedAt, ...rest } = token;
        const claims = resolveTimeClaims(rest, user != null, now);
        const base: JWT = { ...rest, ...(user ? { id: user.id } : {}), ...claims };

        const userId = base.sub ?? base.id;
        if (!userId) {
          console.warn("[auth] session rejected: token has no user id");
          return null;
        }

        const { dbUser, timeoutMinutes } = await loadSessionInputs(userId);
        const evaluation = evaluateSession({ token: claims, user: dbUser, timeoutMinutes, now });
        if (!evaluation.valid) {
          console.info("[auth] session rejected", { userId, reason: evaluation.reason });
          return null;
        }

        return {
          ...base,
          role: evaluation.user.role,
          useGravatar: evaluation.user.useGravatar,
          lastActivityAt: trigger === "update" && isSessionActivityUpdate(session) ? now : claims.lastActivityAt,
        };
      },
    },
  };
});
