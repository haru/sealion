import { auth } from "@/lib/auth";
import { MessageQueueProvider } from "@/components/MessageQueue";

/**
 * Admin section layout — server-side ADMIN role guard plus MessageQueue context.
 *
 * Provides a defence-in-depth check on top of the middleware guard: if a non-admin
 * somehow reaches this layout, they receive a 403 page instead of the child content.
 * Wraps children in {@link MessageQueueProvider} so admin page components can use
 * `useMessageQueue` for transient success/error notifications.
 *
 * @param props - Layout props containing child page content.
 * @returns Children wrapped in MessageQueueProvider for ADMIN users; a 403 page otherwise.
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

  return <MessageQueueProvider>{children}</MessageQueueProvider>;
}
