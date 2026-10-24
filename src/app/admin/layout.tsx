/**
 * Admin section layout: the server-side guard for every `/admin` page.
 */

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import DashboardShell from "@/components/layout/DashboardShell";
import { auth } from "@/lib/auth/auth";
import { getGravatarUrl } from "@/lib/gravatar/gravatar";

import { AdminSessionProvider } from "./AdminSessionProvider";

/**
 * Admin section layout — server-side ADMIN role guard with full dashboard shell.
 *
 * Unauthenticated, revoked or expired visitors are redirected to `/login`; signed-in non-admins
 * receive a localized 403 page. No middleware or proxy guard runs in front of this layout
 * (the root `middleware.ts` is not loaded under `src/`), so this check is authoritative.
 * Wraps children in {@link DashboardShell} for sidebar / title bar and
 * {@link AdminSessionProvider} for client-side session context.
 *
 * @param props - Layout props containing child page content.
 * @returns Children wrapped in DashboardShell for ADMIN users; a localized 403 page for other signed-in users.
 * Unauthenticated visitors are redirected to the login page.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    // Revoked, suspended, deleted or expired sessions resolve to null (spec 045, FR-006).
    redirect("/login");
  }

  const t = await getTranslations("admin");

  if (session.user.role !== "ADMIN") {
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        <h1>{t("forbiddenTitle")}</h1>
        <p>{t("forbiddenMessage")}</p>
      </main>
    );
  }

  const email = session.user.email ?? "";
  const gravatarUrl = session.user.useGravatar ? getGravatarUrl(email, 32) : undefined;

  return (
    <DashboardShell email={email} role={session.user.role ?? "USER"} gravatarUrl={gravatarUrl}>
      <AdminSessionProvider userId={session.user.id}>{children}</AdminSessionProvider>
    </DashboardShell>
  );
}
