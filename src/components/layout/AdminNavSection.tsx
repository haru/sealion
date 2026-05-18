"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Collapse, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ADMIN_PARENT, type PageRouteConfig, PAGE_ROUTES } from "@/lib/ui/page-routes";

/** Props for {@link AdminNavSection}. */
interface AdminNavSectionProps {
  /** Drawer variant — used to decide whether to close on navigation. */
  variant: "permanent" | "temporary";
  /** Callback invoked when the drawer requests to be closed. */
  onClose: () => void;
}

/** Admin sub-routes rendered inside the collapsible section. */
const ADMIN_NAV_ITEMS: Array<Pick<PageRouteConfig, "path" | "sidebarLabelKey">> = [
  { path: "/admin/users", sidebarLabelKey: "userManagement" },
  { path: "/admin/auth-settings", sidebarLabelKey: "authSettings" },
  { path: "/admin/smtp-settings", sidebarLabelKey: "smtpSettings" },
  { path: "/admin/auth-providers", sidebarLabelKey: "oidcSettings" },
];

/** Shared sx prop for a selected nav item in the sidebar. */
const selectedSx = {
  bgcolor: "#eef2ff",
  color: "primary.main",
  "& .MuiListItemIcon-root": { color: "primary.main" },
  "&:hover": { bgcolor: "#e0e7ff" },
};

/** Base sx prop for an unselected nav item in the sidebar. */
const baseItemSx = (pathname: string, href: string) => ({
  borderRadius: "8px",
  mb: 0.5,
  ...(href.startsWith("/admin") ? { pl: 3.5, pr: 1.5 } : { px: 1.5 }),
  py: 0.875,
  color: "text.secondary",
  "&:hover": { bgcolor: "#f1f5f9" },
  ...(pathname === href ? selectedSx : {}),
});

/**
 * Collapsible system administration submenu for admin users.
 * @param props - Controls for drawer variant and close callback.
 * @returns A collapsible list of admin navigation links.
 */
export default function AdminNavSection({ variant, onClose }: AdminNavSectionProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith("/admin"));

  return (
    <>
      <ListItemButton
        onClick={() => setAdminOpen((prev) => !prev)}
        sx={{
          borderRadius: "8px",
          mb: 0.5,
          px: 1.5,
          py: 0.875,
          color: "text.secondary",
          "&:hover": { bgcolor: "#f1f5f9" },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
          <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />
        </ListItemIcon>
        <ListItemText
          primary={<Typography sx={{ fontSize: "0.85rem", fontWeight: 500 }}>{t(ADMIN_PARENT.sidebarLabelKey)}</Typography>}
        />
        {adminOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
      </ListItemButton>

      <Collapse in={adminOpen} timeout="auto" unmountOnExit>
        <List disablePadding>
          {ADMIN_NAV_ITEMS.map((item) => {
            const route = PAGE_ROUTES.find((r) => r.path === item.path);
            const Icon = route?.icon;
            const isSelected = pathname === item.path;
            return (
              <ListItemButton
                key={item.path}
                component={Link}
                href={item.path}
                selected={isSelected}
                onClick={variant === "temporary" ? onClose : undefined}
                sx={baseItemSx(pathname, item.path)}
              >
                {Icon && (
                  <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
                    <Icon sx={{ fontSize: 18 }} />
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={<Typography sx={{ fontSize: "0.85rem", fontWeight: isSelected ? 600 : 500 }}>{t(item.sidebarLabelKey)}</Typography>}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>
    </>
  );
}
