"use client";

import { createContext, useContext } from "react";

const AdminSessionContext = createContext<{ userId: string | undefined }>({ userId: undefined });

/** Provides the current admin user's ID to child client components without requiring SessionProvider. */
export function AdminSessionProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: React.ReactNode;
}) {
  return <AdminSessionContext.Provider value={{ userId }}>{children}</AdminSessionContext.Provider>;
}

/** Returns the current user's ID within the admin section layout tree. */
export function useAdminUserId(): string | undefined {
  return useContext(AdminSessionContext).userId;
}
