/**
 * Login page — server component.
 * Server-fetches enabled IdPs so the LoginForm + ExternalProviderButtons render
 * in one round-trip. Also reads `?error=` query for IdP-callback failure codes.
 */

import { redirect } from "next/navigation";

import { getAuthSettings } from "@/lib/auth/auth-settings";
import { prisma } from "@/lib/db/db";
import { getSmtpSettings } from "@/lib/email/smtp-settings";
import { listEnabledDisplayOnly } from "@/services/auth-provider/repository";

import { LoginForm } from "./LoginForm";

interface LoginPageProps {
  searchParams?: Promise<{ error?: string }>;
}

/**
 * Renders the local credentials form alongside any configured external IdP
 * buttons. Redirects to `/setup` when no users exist.
 *
 * @param props - Next.js search params (Promise in App Router).
 * @returns The rendered login page.
 */
export default async function LoginPage(props: LoginPageProps) {
  const count = await prisma.user.count();
  if (count === 0) {
    redirect("/setup");
  }

  const [{ allowUserSignup }, smtpSettings, enabled, resolvedSearch] = await Promise.all([
    getAuthSettings(),
    getSmtpSettings(),
    listEnabledDisplayOnly(),
    props.searchParams ?? Promise.resolve({} as { error?: string }),
  ]);

  const providers = enabled.map((r) => ({
    providerId: r.providerId,
    type: r.type,
    displayName: r.displayName,
  }));

  return (
    <LoginForm
      showSignup={allowUserSignup}
      showPasswordReset={smtpSettings !== null}
      externalProviders={providers}
      externalError={resolvedSearch?.error ?? null}
    />
  );
}
