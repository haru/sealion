"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { usePageHeaderContext } from "@/contexts/PageHeaderContext";
import { getPageRoute } from "@/lib/ui/page-routes";

/** Default namespace used when the current pathname has no matching route. */
const FALLBACK_NAMESPACE = "common";

/**
 * Looks up the current route's metadata from the centralised route config
 * and automatically registers the icon, breadcrumb parent, and translated
 * title in the shared titlebar.
 *
 * Accept optional overrides for `actions` and `titleAddon` which are not
 * part of the static route config.
 *
 * @param actions - Optional right-slot content for the titlebar.
 * @param titleAddon - Optional node rendered after the title text.
 */
export function usePageMeta(actions?: React.ReactNode, titleAddon?: React.ReactNode): void {
  const pathname = usePathname();
  const { setPageHeader } = usePageHeaderContext();
  const route = getPageRoute(pathname);

  const t = useTranslations(route?.titleNamespace ?? FALLBACK_NAMESPACE);
  const title = route ? t(route.titleKey as Parameters<typeof t>[0]) : "";
  const icon = route?.icon;

  const parentNamespace = route?.breadcrumbParent?.titleNamespace ?? FALLBACK_NAMESPACE;
  const parentKey = route?.breadcrumbParent?.titleKey ?? "";
  const tParent = useTranslations(parentNamespace);
  const breadcrumbParentLabel = route?.breadcrumbParent
    ? tParent(parentKey as Parameters<typeof tParent>[0])
    : undefined;

  useEffect(() => {
    setPageHeader(title, actions, icon, titleAddon, breadcrumbParentLabel, route?.breadcrumbParent?.icon);
    return () => setPageHeader("", null);
  }, [title, actions, icon, titleAddon, breadcrumbParentLabel, route?.breadcrumbParent?.icon, setPageHeader]);
}
