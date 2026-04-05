import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getAuthSettings } from "@/lib/auth/auth-settings";
import { authConfig } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/db";

/** Seconds between re-checks of `passwordChangedAt` in the JWT callback. */
const PWD_CHANGE_RECHECK_INTERVAL_S = 5 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
  providers: [
    Credentials({
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

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) { return null; }

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * JWT callback — extends the base callback from auth.config.ts with session timeout support.
     *
     * On `signIn`, reads `sessionTimeoutMinutes` from AuthSettings and sets `token.exp` when
     * a non-null timeout is configured. Other triggers leave the token unchanged.
     *
     * Also checks `user.passwordChangedAt` to invalidate sessions after a password change.
     * To reduce database load, `passwordChangedAt` is cached in the JWT token and only
     * re-queried from the database every {@link PWD_CHANGE_RECHECK_INTERVAL_S} seconds.
     *
     * @param token - The current JWT payload.
     * @param user - The authenticated user object (present only on signIn).
     * @param trigger - The event that triggered the callback.
     * @returns The updated JWT token, or an empty object to reject the session.
     */
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; email?: string | null; role: string }).role;
      }

      if (trigger === "signIn") {
        const { sessionTimeoutMinutes } = await getAuthSettings();
        if (sessionTimeoutMinutes !== null) {
          token.exp = Math.floor(Date.now() / 1000) + sessionTimeoutMinutes * 60;
        }
      }

      const userId = (token.sub as string | undefined) ?? (token.id as string | undefined);
      if (userId) {
        const now = Math.floor(Date.now() / 1000);
        const lastChecked = (token.pwdCheckedAt as number | undefined) ?? 0;

        if (now - lastChecked >= PWD_CHANGE_RECHECK_INTERVAL_S) {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { passwordChangedAt: true },
          });

          token.pwdChangedAt = dbUser?.passwordChangedAt
            ? Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
            : null;
          token.pwdCheckedAt = now;
        }

        if (token.pwdChangedAt != null) {
          const iat = token.iat as number | undefined;
          if (iat !== undefined && iat < (token.pwdChangedAt as number)) {
            return {};
          }
        }
      }

      return token;
    },
  },
});
