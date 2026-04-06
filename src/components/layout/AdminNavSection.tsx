"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PeopleIcon from "@mui/icons-material/People";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import { Collapse, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Props for {@link AdminNavSection}. */
interface AdminNavSectionProps {
  /** Drawer variant — used to decide whether to close on navigation. */
  variant: "permanent" | "temporary";
  /** Callback invoked when the drawer requests to be closed. */
  onClose: () => void;
}

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
  ...(pathname === href ? selectedSx : {}),
  "&:hover": { bgcolor: "#f1f5f9" },
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
          primary={t("systemAdmin")}
          primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
        />
        {adminOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
      </ListItemButton>

      <Collapse in={adminOpen} timeout="auto" unmountOnExit>
        <List disablePadding>
          <ListItemButton
            component={Link}
            href="/admin/users"
            selected={pathname === "/admin/users"}
            onClick={variant === "temporary" ? onClose : undefined}
            sx={baseItemSx(pathname, "/admin/users")}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
              <PeopleIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary={t("userManagement")}
              primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: pathname === "/admin/users" ? 600 : 500 }}
            />
          </ListItemButton>

          <ListItemButton
            component={Link}
            href="/admin/auth-settings"
            selected={pathname === "/admin/auth-settings"}
            onClick={variant === "temporary" ? onClose : undefined}
            sx={baseItemSx(pathname, "/admin/auth-settings")}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
              <SecurityOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary={t("authSettings")}
              primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: pathname === "/admin/auth-settings" ? 600 : 500 }}
            />
          </ListItemButton>

          <ListItemButton
            component={Link}
            href="/admin/smtp-settings"
            selected={pathname === "/admin/smtp-settings"}
            onClick={variant === "temporary" ? onClose : undefined}
            sx={baseItemSx(pathname, "/admin/smtp-settings")}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
              <EmailOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary={t("smtpSettings")}
              primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: pathname === "/admin/smtp-settings" ? 600 : 500 }}
            />
          </ListItemButton>
        </List>
      </Collapse>
    </>
  );
}
