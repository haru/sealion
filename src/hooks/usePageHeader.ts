"use client";

import { useEffect } from "react";

import { usePageHeaderContext } from "@/contexts/PageHeaderContext";

/**
 * Registers this page's title, optional right-slot actions, optional icon, and optional title-area addon
 * in the shared titlebar rendered by `DashboardShell`.
 *
 * Call this hook at the top of every dashboard page component. The titlebar is updated
 * whenever any argument changes, and cleared when the component unmounts.
 *
 * @param title - The page title to display in the titlebar.
 * @param actions - Optional React node rendered in the titlebar's right slot.
 * @param icon - Optional icon component rendered to the left of the title.
 * @param titleAddon - Optional React node rendered immediately after the title text (e.g. a status chip).
 */
export function usePageHeader(title: string, actions?: React.ReactNode, icon?: React.ElementType, titleAddon?: React.ReactNode): void {
  const { setPageHeader } = usePageHeaderContext();

  useEffect(() => {
    setPageHeader(title, actions, icon, titleAddon);
    return () => setPageHeader("", null);
  }, [title, actions, icon, titleAddon, setPageHeader]);
}
