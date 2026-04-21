import { redirect } from "next/navigation";

import DashboardShell from "@/components/layout/DashboardShell";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

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

  const userId = session.user.id;
  let useGravatar = false;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { useGravatar: true },
    });
    useGravatar = user?.useGravatar ?? false;
  }

  return (
    <DashboardShell email={session.user.email ?? ""} role={session.user.role ?? "USER"} useGravatar={useGravatar}>
      {children}
    </DashboardShell>
  );
}
