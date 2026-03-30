"use client";

import { createContext, useContext } from "react";

const AdminSessionContext = createContext<{ userId: string | undefined }>({ userId: undefined });

/**
 * Provides the current admin user's ID to child client components without requiring SessionProvider.
 *
 * Intended to be mounted once in the admin section server layout after validating the session,
 * then consumed by any client component in the tree via {@link useAdminUserId}.
 *
 * @param props - `userId`: the authenticated admin's ID (or `undefined`); `children`: the React subtree.
 * @returns A context provider wrapping the given children.
 */
export function AdminSessionProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: React.ReactNode;
}) {
  return <AdminSessionContext.Provider value={{ userId }}>{children}</AdminSessionContext.Provider>;
}

/**
 * Returns the current admin user's ID from the nearest {@link AdminSessionProvider} ancestor.
 *
 * @returns The admin user's ID string, or `undefined` if the context has not been provided.
 */
export function useAdminUserId(): string | undefined {
  return useContext(AdminSessionContext).userId;
}
