"use client";

import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { version } from "@/../package.json";

import AdminNavSection from "./AdminNavSection";

const DRAWER_WIDTH = 240;
const RELEASE_URL = `https://github.com/haru/sealion/`;

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
        <ListItemButton
          component={Link}
          href="/"
          selected={pathname === "/"}
          onClick={variant === "temporary" ? onClose : undefined}
          sx={mainItemSx(pathname === "/")}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <FormatListBulletedIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t("todo")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: pathname === "/" ? 600 : 500 }}
          />
        </ListItemButton>

        <ListItemButton
          component={Link}
          href="/projects"
          selected={pathname === "/projects"}
          onClick={variant === "temporary" ? onClose : undefined}
          sx={mainItemSx(pathname === "/projects")}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <FolderOpenIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t("projectManagement")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: pathname === "/projects" ? 600 : 500 }}
          />
        </ListItemButton>

        <ListItemButton
          component={Link}
          href="/settings/board"
          selected={pathname === "/settings/board"}
          onClick={variant === "temporary" ? onClose : undefined}
          sx={mainItemSx(pathname === "/settings/board")}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <TuneIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t("boardSettings")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: pathname === "/settings/board" ? 600 : 500 }}
          />
        </ListItemButton>

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
