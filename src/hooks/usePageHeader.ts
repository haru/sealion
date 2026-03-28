"use client";

import { useEffect } from "react";
import { usePageHeaderContext } from "@/contexts/PageHeaderContext";

/**
 * Registers this page's title and optional right-slot actions in the shared titlebar
 * rendered by `DashboardShell`.
 *
 * Call this hook at the top of every dashboard page component. The titlebar is updated
 * whenever `title` or `actions` changes, and cleared when the component unmounts.
 *
 * @param title - The page title to display in the titlebar.
 * @param actions - Optional React node rendered in the titlebar's right slot.
 */
export function usePageHeader(title: string, actions?: React.ReactNode): void {
  const { setPageHeader } = usePageHeaderContext();

  useEffect(() => {
    setPageHeader(title, actions);
    return () => setPageHeader("", null);
  }, [title, actions, setPageHeader]);
}
