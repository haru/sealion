/**
 * Auth.js v5 runtime entry point. Builds the providers list on every request from
 * the DB-backed `AuthProvider` registry, layered on top of the static Credentials provider.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getSessionTimeoutMinutes } from "@/lib/auth/auth-settings";
import { authConfig } from "@/lib/auth/auth.config";
import { evaluateSession } from "@/lib/auth/session-validity";
import { prisma } from "@/lib/db/db";
import {
  getAuthProviderMetadata,
  listEnabled,
} from "@/services/auth-provider";
import { handleExternalSignIn } from "@/services/auth-provider/account-linking";

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
       * On `signIn`, stamps the app-owned `authTime` and `lastActivityAt` claims. Auth.js overwrites
       * `iat`/`exp` on every encode, so security decisions never use them.
       *
       * On every call, loads the user by primary key and runs {@link evaluateSession}. The session is
       * rejected (by returning `null`, never `{}`) when the user is gone or not ACTIVE, when the
       * session predates a password change or an admin revocation, or when it has been idle longer
       * than the configured timeout. `role` and `useGravatar` are always taken from the database.
       *
       * Only `trigger === "update"` with `session.activity === true` refreshes `lastActivityAt`, so
       * background refetches and other `update()` calls never extend the idle timeout.
       *
       * Tokens issued before this change lack the time claims; they are stamped with the current
       * time so nobody is signed out by the deployment.
       *
       * @param token - The current JWT payload.
       * @param user - The authenticated user object (present only on signIn).
       * @param trigger - The event that triggered the callback.
       * @param session - The session update payload (present only on `update` trigger).
       * @returns The updated token, or `null` to end the session.
       * @throws Re-throws database errors so that validation fails closed.
       */
      async jwt({ token, user, trigger, session }) {
        const now = Date.now();

        if (user) {
          token.id = user.id;
          token.authTime = now;
          token.lastActivityAt = now;
        }
        token.authTime = (token.authTime as number | undefined) ?? now;
        token.lastActivityAt = (token.lastActivityAt as number | undefined) ?? now;
        delete token.pwdCheckedAt;
        delete token.pwdChangedAt;

        const userId = (token.sub as string | undefined) ?? (token.id as string | undefined);
        if (!userId) { return token; }

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

        const evaluation = evaluateSession({
          token: { authTime: token.authTime as number, lastActivityAt: token.lastActivityAt as number },
          user: dbUser,
          timeoutMinutes: await getSessionTimeoutMinutes(),
          now,
        });
        if (!evaluation.valid || dbUser === null) { return null; }

        token.role = dbUser.role;
        token.useGravatar = dbUser.useGravatar;

        const isActivityUpdate =
          trigger === "update" && (session as { activity?: unknown } | undefined)?.activity === true;
        if (isActivityUpdate) {
          token.lastActivityAt = now;
        }

        return token;
      },
    },
  };
});
