import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { verifyToken, TokenExpiredError, getAppBaseUrl } from "@/lib/email-verification";

/**
 * GET /api/auth/confirm — Verifies an email confirmation token.
 *
 * Reads the `token` query parameter, validates it via `verifyToken()`, and
 * redirects to `/login?verified=true` on success. On failure (expired,
 * invalid, or missing token), redirects to `/confirm?error=<error_type>`.
 *
 * @param request - The incoming GET request with an optional `token` query parameter.
 * @returns A 307 redirect response.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const baseUrl = getAppBaseUrl();

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/confirm?error=missing_token`);
  }

  try {
    const user = await verifyToken(token);

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/confirm?error=invalid_token`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        emailVerificationToken: null,
        emailVerificationTokenExpires: null,
      },
    });

    return NextResponse.redirect(`${baseUrl}/login?verified=true`);
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      return NextResponse.redirect(`${baseUrl}/confirm?error=expired_token`);
    }
    return NextResponse.redirect(`${baseUrl}/confirm?error=invalid_token`);
  }
}
