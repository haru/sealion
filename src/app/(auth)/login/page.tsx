import { redirect } from "next/navigation";

import { getAuthSettings } from "@/lib/auth/auth-settings";
import { prisma } from "@/lib/db/db";
import { getSmtpSettings } from "@/lib/email/smtp-settings";

import { LoginForm } from "./LoginForm";

/**
 * Login page — server component.
 *
 * Redirects to `/setup` when no users exist in the database (first-time setup).
 * Otherwise renders the login form, passing the current `allowUserSignup` setting
 * and whether the "Forgot password?" link should be shown (SMTP configured).
 */
export default async function LoginPage() {
  const count = await prisma.user.count();
  if (count === 0) {
    redirect("/setup");
  }

  const [{ allowUserSignup }, smtpSettings] = await Promise.all([
    getAuthSettings(),
    getSmtpSettings(),
  ]);

  return <LoginForm showSignup={allowUserSignup} showPasswordReset={smtpSettings !== null} />;
}
