import { auth } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";
import { AdminSessionProvider } from "./AdminSessionProvider";

/**
 * Admin section layout — server-side ADMIN role guard with full dashboard shell.
 *
 * Provides a defence-in-depth check on top of the middleware guard: if a non-admin
 * somehow reaches this layout, they receive a 403 page instead of the child content.
 * Wraps children in {@link DashboardShell} for sidebar / title bar and
 * {@link AdminSessionProvider} for client-side session context.
 *
 * @param props - Layout props containing child page content.
 * @returns Children wrapped in DashboardShell for ADMIN users; a 403 page otherwise.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        <h1>403 — Forbidden</h1>
        <p>You do not have permission to access this page.</p>
      </main>
    );
  }

  return (
    <DashboardShell email={session.user.email ?? ""} role={session.user.role ?? "USER"}>
      <AdminSessionProvider userId={session.user.id}>{children}</AdminSessionProvider>
    </DashboardShell>
  );
}
