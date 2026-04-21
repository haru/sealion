import { redirect } from "next/navigation";

import DashboardShell from "@/components/layout/DashboardShell";
import { auth } from "@/lib/auth/auth";
import { getGravatarUrl } from "@/lib/gravatar/gravatar";

/** Authenticated dashboard layout — redirects unauthenticated users to /login. */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const email = session.user.email ?? "";
  const gravatarUrl = session.user.useGravatar ? getGravatarUrl(email, 32) : undefined;

  return (
    <DashboardShell email={email} role={session.user.role ?? "USER"} gravatarUrl={gravatarUrl}>
      {children}
    </DashboardShell>
  );
}
