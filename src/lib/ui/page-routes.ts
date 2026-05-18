/**
 * Centralised route metadata registry.
 *
 * Each dashboard / admin page is declared once here with its icon, optional
 * breadcrumb parent, and translation keys.  Both the sidebar navigation and
 * the page-header titlebar read from this single source of truth so that
 * icons and labels are guaranteed to stay in sync.
 *
 * The sidebar uses the `sidebarLabelKey` for its nav items while the
 * titlebar uses `titleNamespace` + `titleKey`.  The `icon` component is
 * shared across both surfaces.
 */

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import KeyIcon from "@mui/icons-material/Key";
import PeopleIcon from "@mui/icons-material/People";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";

/** Metadata for a single page route. */
export interface PageRouteConfig {
  /** Route pathname (exact match). */
  path: string;
  /** Icon component rendered in the sidebar and titlebar. */
  icon: React.ElementType;
  /** next-intl namespace for the page title (used by the titlebar). */
  titleNamespace: string;
  /** Key inside `titleNamespace` for the page title. */
  titleKey: string;
  /** Key inside the `sidebar` namespace for the nav-item label. */
  sidebarLabelKey: string;
  /** When set, the titlebar renders "parent / title" breadcrumbs. */
  breadcrumbParent?: Pick<PageRouteConfig, "path" | "icon" | "titleNamespace" | "titleKey" | "sidebarLabelKey">;
}

/** Well-known route key used as the breadcrumb parent for all admin pages. */
export const ADMIN_PARENT: PageRouteConfig = {
  path: "/admin",
  icon: AdminPanelSettingsIcon,
  titleNamespace: "sidebar",
  titleKey: "systemAdmin",
  sidebarLabelKey: "systemAdmin",
};

/** All page routes with their metadata. */
export const PAGE_ROUTES: PageRouteConfig[] = [
  {
    path: "/",
    icon: FormatListBulletedIcon,
    titleNamespace: "todo",
    titleKey: "title",
    sidebarLabelKey: "todo",
  },
  {
    path: "/projects",
    icon: FolderOpenIcon,
    titleNamespace: "projects",
    titleKey: "title",
    sidebarLabelKey: "projectManagement",
  },
  {
    path: "/settings/board",
    icon: TuneIcon,
    titleNamespace: "boardSettings",
    titleKey: "title",
    sidebarLabelKey: "boardSettings",
  },
  {
    path: "/settings/profile",
    icon: AccountCircleIcon,
    titleNamespace: "profileSettings",
    titleKey: "title",
    sidebarLabelKey: "profileSettings",
  },
  {
    path: "/settings/providers",
    icon: SettingsIcon,
    titleNamespace: "providers",
    titleKey: "title",
    sidebarLabelKey: "issueSettings",
  },
  {
    path: "/admin/users",
    icon: PeopleIcon,
    titleNamespace: "admin",
    titleKey: "userManagement",
    sidebarLabelKey: "userManagement",
    breadcrumbParent: ADMIN_PARENT,
  },
  {
    path: "/admin/auth-settings",
    icon: SecurityOutlinedIcon,
    titleNamespace: "authSettings",
    titleKey: "title",
    sidebarLabelKey: "authSettings",
    breadcrumbParent: ADMIN_PARENT,
  },
  {
    path: "/admin/smtp-settings",
    icon: EmailOutlinedIcon,
    titleNamespace: "smtpSettings",
    titleKey: "title",
    sidebarLabelKey: "smtpSettings",
    breadcrumbParent: ADMIN_PARENT,
  },
  {
    path: "/admin/auth-providers",
    icon: KeyIcon,
    titleNamespace: "authProviders.admin",
    titleKey: "title",
    sidebarLabelKey: "oidcSettings",
    breadcrumbParent: ADMIN_PARENT,
  },
];

/** Fast lookup map keyed by `path`. */
const ROUTE_MAP = new Map(PAGE_ROUTES.map((r) => [r.path, r]));

/**
 * Returns the route config for the given pathname, or `undefined` if not
 * registered.
 *
 * @param pathname - The current route pathname.
 * @returns The matching {@link PageRouteConfig} or undefined.
 */
export function getPageRoute(pathname: string): PageRouteConfig | undefined {
  return ROUTE_MAP.get(pathname);
}
