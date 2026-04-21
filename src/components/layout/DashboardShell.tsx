"use client";

import { MessageQueueProvider } from "@/components/MessageQueue";
import { PageHeaderProvider } from "@/contexts/PageHeaderContext";

import DashboardShellInner from "./DashboardShellInner";

/** Props for {@link DashboardShell}. */
interface DashboardShellProps {
  /** Authenticated user's email address, forwarded to the {@link Sidebar} profile footer. */
  email: string;
  /** Authenticated user's role, used to conditionally show admin navigation. */
  role: string;
  /** Whether the user has enabled Gravatar as their avatar. */
  useGravatar: boolean;
  /** Page content rendered inside the main scrollable area. */
  children: React.ReactNode;
}

/**
 * Top-level authenticated shell with sidebar, global titlebar, and main content area.
 * @param props - Shell props containing the authenticated user's email, role, useGravatar, and page children.
 * @returns The full dashboard layout wrapped in context providers.
 */
export default function DashboardShell({ email, role, useGravatar, children }: DashboardShellProps) {
  return (
    <MessageQueueProvider>
      <PageHeaderProvider>
        <DashboardShellInner email={email} role={role} useGravatar={useGravatar}>{children}</DashboardShellInner>
      </PageHeaderProvider>
    </MessageQueueProvider>
  );
}
