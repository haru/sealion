"use client";

import { useEffect } from "react";

import { usePageHeaderContext } from "@/contexts/PageHeaderContext";

/**
 * Registers this page's title, optional right-slot actions, optional icon, optional title-area addon,
 * and optional breadcrumb parent in the shared titlebar rendered by `DashboardShell`.
 *
 * Call this hook at the top of every dashboard page component. The titlebar is updated
 * whenever any argument changes, and cleared when the component unmounts.
 *
 * @param title - The page title to display in the titlebar.
 * @param actions - Optional React node rendered in the titlebar's right slot.
 * @param icon - Optional icon component rendered to the left of the title.
 * @param titleAddon - Optional React node rendered immediately after the title text (e.g. a status chip).
 * @param breadcrumbParent - Optional parent label rendered as the first breadcrumb segment (e.g. "System Settings").
 * @param breadcrumbParentIcon - Optional icon component rendered to the left of the breadcrumb parent label.
 */
export function usePageHeader(title: string, actions?: React.ReactNode, icon?: React.ElementType, titleAddon?: React.ReactNode, breadcrumbParent?: string, breadcrumbParentIcon?: React.ElementType): void {
  const { setPageHeader } = usePageHeaderContext();

  useEffect(() => {
    setPageHeader(title, actions, icon, titleAddon, breadcrumbParent, breadcrumbParentIcon);
    return () => setPageHeader("", null);
  }, [title, actions, icon, titleAddon, breadcrumbParent, breadcrumbParentIcon, setPageHeader]);
}
