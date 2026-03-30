import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";

/** Authenticated dashboard layout — redirects unauthenticated users to /login. */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <DashboardShell email={session.user.email ?? ""} role={session.user.role ?? "USER"}>
      {children}
    </DashboardShell>
  );
}
