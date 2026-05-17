/**
 * External-IdP sign-in handler. Verifies the IdP's email-verified claim, then
 * either links the IdP account to an existing Sealion user (matched by email)
 * or creates a new user honouring `AuthSettings.allowUserSignup` /
 * `requireEmailVerification`.
 */

import axios from "axios";
import type { Account, Profile, User } from "next-auth";

import { getAuthSettings } from "@/lib/auth/auth-settings";
import { prisma } from "@/lib/db/db";
import { AuthProviderType } from "@/services/auth-provider/types";

/** GitHub `/user/emails` API response shape. */
interface GithubEmailEntry {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
}

/** Auth.js signIn callback payload, narrowed to the fields we consume. */
export interface HandleExternalSignInParams {
  user: User;
  account: Account | null;
  profile?: Profile | null;
}

/** Profile shape narrowed to the fields IdPs commonly return for email verification. */
interface ExternalProfileLike {
  email?: string | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  email_verified?: boolean;
  name?: string | null;
  picture?: string | null;
}

/**
 * Routes an external (OAuth/OIDC) sign-in through Sealion's account-linking
 * policy: email verification, find-or-create user, create the linking Account row.
 *
 * @param params - The Auth.js `signIn` callback payload.
 * @returns `true` to allow sign-in, `false` to deny with the generic Auth.js
 *   error page, or a `/login?error=…` redirect URL for a specific failure.
 * @throws Re-throws any unexpected Prisma error.
 */
export async function handleExternalSignIn(
  params: HandleExternalSignInParams,
): Promise<boolean | string> {
  const { user, account, profile } = params;
  if (!account || account.type === "credentials") { return true; }

  const profileLike = (profile ?? {}) as ExternalProfileLike;
  const accessToken = (account as Record<string, unknown>).access_token as string | null ?? null;

  const providerInfo = await prisma.authProvider.findUnique({
    where: { providerId: account.provider },
    select: { type: true },
  });
  const providerType = providerInfo?.type ?? null;

  let rawEmail = profileLike.email ?? user.email ?? null;
  let emailVerifiedByGithub = false;

  if (!rawEmail && providerType === AuthProviderType.GITHUB && accessToken) {
    const resolved = await tryResolveGithubPrimaryEmail(accessToken);
    if (resolved) {
      rawEmail = resolved;
      emailVerifiedByGithub = true;
    }
  }

  if (!rawEmail) { return "/login?error=NO_EMAIL_FROM_PROVIDER"; }

  const email = rawEmail.toLowerCase();

  const emailVerified = emailVerifiedByGithub
    ? true
    : await resolveEmailVerified({
        profileEmailVerified: profileLike.email_verified === true,
        providerType,
        accessToken,
        email,
      });

  const settings = await getAuthSettings();
  const requireVerification = settings.requireEmailVerification ?? false;

  if (!emailVerified && !requireVerification) {
    return "/login?error=EMAIL_NOT_VERIFIED";
  }

  return linkOrCreateUser({ email, emailVerified, requireVerification, profileLike, account });
}

/** Resolves an existing user by email, checks status, and links the account. */
async function linkOrCreateUser(params: {
  email: string;
  emailVerified: boolean;
  requireVerification: boolean;
  profileLike: ExternalProfileLike;
  account: Account;
}): Promise<boolean | string> {
  const { email, emailVerified, requireVerification, profileLike, account } = params;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.status === "SUSPENDED") { return false; }
    if (existing.status === "PENDING") { return "/login?error=EMAIL_NOT_VERIFIED"; }
    return linkAccountIfMissing(existing.id, account);
  }

  const settings = await getAuthSettings();
  if (!settings.allowUserSignup) {
    return "/login?error=SIGNUP_DISABLED";
  }
  return createUserAndLink({
    email,
    emailVerified,
    requireVerification,
    profileName: profileLike.name,
    account,
  });
}

/** Creates the `Account` link only when one does not already exist. */
async function linkAccountIfMissing(
  userId: string,
  account: Account,
): Promise<true> {
  const already = await prisma.account.findUnique({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
  });
  if (!already) {
    await prisma.account.create({
      data: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        type: account.type,
        userId,
      },
    });
  }
  return true;
}

interface CreateUserAndLinkParams {
  email: string;
  emailVerified: boolean;
  requireVerification: boolean;
  profileName: string | null | undefined;
  account: Account;
}

/** Creates a new `User` + `Account` pair and returns `true`. */
async function createUserAndLink(p: CreateUserAndLinkParams): Promise<true> {
  const status: "PENDING" | "ACTIVE" =
    p.requireVerification && !p.emailVerified ? "PENDING" : "ACTIVE";

  const newUser = await prisma.user.create({
    data: {
      email: p.email,
      passwordHash: null,
      role: "USER",
      status,
      username: deriveUsername(p.profileName, p.email),
      useGravatar: false,
    },
    select: { id: true },
  });

  await prisma.account.create({
    data: {
      provider: p.account.provider,
      providerAccountId: p.account.providerAccountId,
      type: p.account.type,
      userId: newUser.id,
    },
  });

  return true;
}

interface ResolveEmailVerifiedParams {
  profileEmailVerified: boolean;
  providerType: AuthProviderType | null;
  accessToken: string | null;
  email: string;
}

/**
 * Resolves whether an external IdP has verified the user's email. For
 * providers that include the OIDC `email_verified` claim (Google, Entra,
 * generic OIDC), trust the profile value. For GitHub — which lacks the claim —
 * call the `/user/emails` endpoint to check for a verified primary address.
 *
 * @param params - Inputs needed to decide email verification.
 * @returns `true` if the email can be considered verified.
 */
async function resolveEmailVerified(
  params: ResolveEmailVerifiedParams,
): Promise<boolean> {
  if (params.profileEmailVerified) { return true; }
  if (params.providerType === AuthProviderType.GITHUB && params.accessToken) {
    return resolveGithubVerifiedEmail(params.accessToken, params.email);
  }
  return false;
}

/**
 * Tries to resolve the primary verified email from the GitHub `/user/emails`
 * API. Used as a fallback when the GitHub profile does not expose the email.
 *
 * @param accessToken - The GitHub OAuth access token.
 * @returns The lowercase primary verified email, or `null` if unavailable.
 */
async function tryResolveGithubPrimaryEmail(
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await axios.get<GithubEmailEntry[]>("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    const primary = res.data.find((e) => e.primary && e.verified);
    return primary?.email?.toLowerCase() ?? null;
  } catch (err: unknown) {
    console.warn("[auth/github-email-resolve] failed to resolve primary email", {
      status: axios.isAxiosError(err) ? err.response?.status : undefined,
      message: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

/**
 * Calls the GitHub `/user/emails` API to find a verified primary email
 * matching the expected address.
 *
 * @param accessToken - The GitHub OAuth access token.
 * @param expectedEmail - The email reported by the profile (lowercase).
 * @returns `true` if a primary + verified entry matching `expectedEmail` exists.
 */
export async function resolveGithubVerifiedEmail(
  accessToken: string,
  expectedEmail: string,
): Promise<boolean> {
  try {
    const res = await axios.get<GithubEmailEntry[]>("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    const verified = res.data.find(
      (e) => e.primary && e.verified && e.email.toLowerCase() === expectedEmail,
    );
    return verified !== undefined;
  } catch (err: unknown) {
    console.warn("[auth/github-email-verify] failed to resolve verified email", {
      email: expectedEmail,
      status: axios.isAxiosError(err) ? err.response?.status : undefined,
      message: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}

/**
 * Derives a non-empty username from the IdP profile name or the email prefix.
 *
 * @param profileName - Optional `profile.name` from the IdP.
 * @param email - The normalised lowercase email address.
 * @returns A best-effort username string.
 */
function deriveUsername(
  profileName: string | null | undefined,
  email: string,
): string {
  const trimmed = profileName?.trim();
  if (trimmed) { return trimmed; }
  const local = email.split("@")[0] ?? email;
  return local;
}

/**
 * Checks whether a user can safely unlink a provider account without losing
 * all authentication methods. At least one method must remain: either a local
 * password or another linked IdP.
 *
 * @param userId - The user's internal ID.
 * @param _provider - The provider string of the Account to unlink.
 * @returns `true` if unlinking is safe.
 */
export async function canUnlinkAccount(
  userId: string,
  _provider: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) { return false; }
  if (user.passwordHash) { return true; }
  const total = await prisma.account.count({ where: { userId } });
  return total > 1;
}
