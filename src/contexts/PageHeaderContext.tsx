"use client";

import { createContext, useContext, useState, useCallback } from "react";

/** Value provided by {@link PageHeaderContext}. */
export interface PageHeaderContextValue {
  /** Current page title displayed in the titlebar. Defaults to empty string. */
  title: string;
  /** Current right-slot content. Defaults to null. */
  actions: React.ReactNode | null;
  /** Icon component displayed to the left of the page title. Defaults to null. */
  icon: React.ElementType | null;
  /** Optional node rendered immediately after the title text. Defaults to null. */
  titleAddon: React.ReactNode | null;
  /**
   * Optional parent label displayed as the first segment of a breadcrumb path.
   * When set, the titlebar renders "parent / title" instead of just "title".
   * Defaults to null.
   */
  breadcrumbParent: string | null;
  /**
   * Optional icon component rendered to the left of the breadcrumb parent label.
   * Only used when `breadcrumbParent` is set.
   * Defaults to null.
   */
  breadcrumbParentIcon: React.ElementType | null;
  /**
   * Registers the current page's title, optional right-slot actions, optional icon, optional title-area addon, optional breadcrumb parent, and optional breadcrumb parent icon in the titlebar.
   * @param title - The page title to display.
   * @param actions - Optional React node rendered in the right slot.
   * @param icon - Optional icon component rendered to the left of the title.
   * @param titleAddon - Optional React node rendered immediately after the title text.
   * @param breadcrumbParent - Optional parent label for breadcrumb display.
   * @param breadcrumbParentIcon - Optional icon component rendered to the left of the breadcrumb parent label.
   */
  setPageHeader: (title: string, actions?: React.ReactNode, icon?: React.ElementType, titleAddon?: React.ReactNode, breadcrumbParent?: string, breadcrumbParentIcon?: React.ElementType) => void;
}

/** Context carrying the current page title, optional leading icon, optional right-slot actions, optional title-area addon, optional breadcrumb parent, and optional breadcrumb parent icon for the global titlebar. */
export const PageHeaderContext = createContext<PageHeaderContextValue>({
  title: "",
  actions: null,
  icon: null,
  titleAddon: null,
  breadcrumbParent: null,
  breadcrumbParentIcon: null,
  setPageHeader: () => undefined,
});

/** Props for {@link PageHeaderProvider}. */
interface PageHeaderProviderProps {
  /** Child components that can register page header content via {@link usePageHeader}. */
  children: React.ReactNode;
}

/**
 * Provides {@link PageHeaderContext} to the component tree.
 * Wrap the authenticated shell layout with this provider so every dashboard page
 * can register its title and optional right-slot actions.
 * @param props - Provider props.
 * @returns Context provider wrapping children.
 */
export function PageHeaderProvider({ children }: PageHeaderProviderProps) {
  const [title, setTitle] = useState("");
  const [actions, setActions] = useState<React.ReactNode | null>(null);
  const [icon, setIcon] = useState<React.ElementType | null>(null);
  const [titleAddon, setTitleAddon] = useState<React.ReactNode | null>(null);
  const [breadcrumbParent, setBreadcrumbParent] = useState<string | null>(null);
  const [breadcrumbParentIcon, setBreadcrumbParentIcon] = useState<React.ElementType | null>(null);

  const setPageHeader = useCallback((newTitle: string, newActions?: React.ReactNode, newIcon?: React.ElementType, newTitleAddon?: React.ReactNode, newBreadcrumbParent?: string, newBreadcrumbParentIcon?: React.ElementType) => {
    setTitle(newTitle);
    setActions(newActions ?? null);
    // Use the functional updater form to prevent React from treating the icon component
    // as a state updater function (React calls functions passed to setState directly).
    setIcon(() => newIcon ?? null);
    setTitleAddon(newTitleAddon ?? null);
    setBreadcrumbParent(newBreadcrumbParent ?? null);
    setBreadcrumbParentIcon(() => newBreadcrumbParentIcon ?? null);
  }, []);

  return (
    <PageHeaderContext.Provider value={{ title, actions, icon, titleAddon, breadcrumbParent, breadcrumbParentIcon, setPageHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

/**
 * Returns the current {@link PageHeaderContextValue} from the nearest {@link PageHeaderProvider}.
 * @returns The page header context value.
 */
export function usePageHeaderContext(): PageHeaderContextValue {
  return useContext(PageHeaderContext);
}
