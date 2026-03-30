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
  /**
   * Registers the current page's title, optional right-slot actions, and optional icon in the titlebar.
   * @param title - The page title to display.
   * @param actions - Optional React node rendered in the right slot.
   * @param icon - Optional icon component rendered to the left of the title.
   */
  setPageHeader: (title: string, actions?: React.ReactNode, icon?: React.ElementType) => void;
}

/** Context carrying the current page title and optional right-slot actions for the global titlebar. */
export const PageHeaderContext = createContext<PageHeaderContextValue>({
  title: "",
  actions: null,
  icon: null,
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

  const setPageHeader = useCallback((newTitle: string, newActions?: React.ReactNode, newIcon?: React.ElementType) => {
    setTitle(newTitle);
    setActions(newActions ?? null);
    setIcon(newIcon ?? null);
  }, []);

  return (
    <PageHeaderContext.Provider value={{ title, actions, icon, setPageHeader }}>
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
