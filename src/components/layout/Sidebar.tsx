"use client";

import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { version } from "@/../package.json";

import { PAGE_ROUTES } from "@/lib/ui/page-routes";

import AdminNavSection from "./AdminNavSection";

const DRAWER_WIDTH = 240;
const RELEASE_URL = `https://github.com/haru/sealion/`;

/** Sidebar nav items (non-admin). */
const MAIN_NAV_ITEMS = [
  { path: "/", sidebarLabelKey: "todo" },
  { path: "/projects", sidebarLabelKey: "projectManagement" },
  { path: "/settings/board", sidebarLabelKey: "boardSettings" },
] as const;

/** Props for {@link Sidebar}. */
interface SidebarProps {
  /** Whether the drawer is open (used when `variant` is `"temporary"`). */
  open: boolean;
  /** Callback invoked when the drawer requests to be closed. */
  onClose: () => void;
  /** Drawer variant — `"permanent"` on desktop, `"temporary"` on mobile. */
  variant: "permanent" | "temporary";
  /** When true, renders the admin-only "System Administration" submenu. */
  isAdmin: boolean;
}

/** sx prop applied to a selected main nav item. */
const selectedMainSx = {
  bgcolor: "#eef2ff",
  color: "primary.main",
  "& .MuiListItemIcon-root": { color: "primary.main" },
  "&:hover": { bgcolor: "#e0e7ff" },
};

/** sx prop for a main nav item, conditionally applying selected styles. */
const mainItemSx = (isSelected: boolean) => ({
  borderRadius: "8px",
  mb: 0.5,
  px: 1.5,
  py: 0.875,
  ...(!isSelected ? { "&:hover": { bgcolor: "#f1f5f9" } } : {}),
  ...(isSelected ? selectedMainSx : {}),
});

/**
 * Navigation drawer with logo and links to main sections.
 * @param props - Sidebar props controlling open state, close callback, drawer variant, and admin flag.
 * @returns A MUI Drawer rendered as permanent on desktop and temporary on mobile.
 */
export default function Sidebar({ open, onClose, variant, isAdmin }: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();

  const content = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        pt: 2,
        pb: 0,
        px: 1.5,
        overflow: "hidden",
      }}
    >
      <Box
        component={Link}
        href="/"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          mb: 3,
          textDecoration: "none",
          color: "inherit",
          flexShrink: 0,
        }}
      >
        <Image src="/sealion.svg" alt="Sealion" width={32} height={32} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "1.1rem",
              letterSpacing: "-0.02em",
              color: "text.primary",
              lineHeight: 1.2,
            }}
          >
            Sealion
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.25,
              fontSize: "0.65rem",
              color: "text.secondary",
              lineHeight: 1.3,
              whiteSpace: "normal",
            }}
          >
            {t("tagline")}
          </Typography>
        </Box>
      </Box>

      <List disablePadding sx={{ flexGrow: 1 }}>
        {MAIN_NAV_ITEMS.map((item) => {
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
              sx={mainItemSx(isSelected)}
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

        {isAdmin && <AdminNavSection variant={variant} onClose={onClose} />}
      </List>

      <Box
        component="a"
        href={RELEASE_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="sidebar-version-link"
        onClick={variant === "temporary" ? onClose : undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 1.5,
          mt: "auto",
          borderTop: 1,
          borderColor: "divider",
          textDecoration: "none",
          color: "text.primary",
          transition: "color 0.2s",
          "&:hover": { color: "primary.main" },
        }}
      >
        <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
          {t("version", { version })}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      data-testid="sidebar"
      variant={variant}
      open={variant === "temporary" ? open : true}
      onClose={onClose}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
        },
      }}
    >
      {content}
    </Drawer>
  );
}
