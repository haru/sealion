import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { getAuthSettings } from "@/lib/auth-settings";

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
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

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

        if (!isValid) return null;

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
     * Also checks `user.passwordChangedAt` — if the JWT was issued before the password was
     * last changed, the session is rejected by returning an empty token object.
     *
     * @param token - The current JWT payload.
     * @param user - The authenticated user object (present only on signIn).
     * @param trigger - The event that triggered the callback.
     * @returns The updated JWT token.
     */
    async jwt({ token, user, trigger }) {
      // Propagate user id and role into the token on initial sign-in
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; email?: string | null; role: string }).role;
      }

      // Only set session expiry on sign-in; leave existing sessions unaffected (EC-003)
      if (trigger === "signIn") {
        const { sessionTimeoutMinutes } = await getAuthSettings();
        if (sessionTimeoutMinutes !== null) {
          token.exp = Math.floor(Date.now() / 1000) + sessionTimeoutMinutes * 60;
        }
      }

      // Invalidate session if password was changed after the token was issued
      const userId = (token.sub as string | undefined) ?? (token.id as string | undefined);
      if (userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { passwordChangedAt: true },
        });

        if (dbUser?.passwordChangedAt) {
          const iat = token.iat as number | undefined;
          if (iat !== undefined && iat < Math.floor(dbUser.passwordChangedAt.getTime() / 1000)) {
            return {};
          }
        }
      }

      return token;
    },
  },
});
