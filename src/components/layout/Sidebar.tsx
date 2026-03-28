"use client";

import {
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import TuneIcon from "@mui/icons-material/Tune";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";

const DRAWER_WIDTH = 240;

/** Props for {@link Sidebar}. */
interface SidebarProps {
  /** Whether the drawer is open (used when `variant` is `"temporary"`). */
  open: boolean;
  /** Callback invoked when the drawer requests to be closed. */
  onClose: () => void;
  /** Drawer variant — `"permanent"` on desktop, `"temporary"` on mobile. */
  variant: "permanent" | "temporary";
  /** Authenticated user's email address, displayed in the profile footer. */
  email: string;
}

/** Navigation drawer with logo, links to main sections, and user profile footer. */
export default function Sidebar({ open, onClose, variant, email }: SidebarProps) {
  const t = useTranslations("sidebar");
  const tAuth = useTranslations("auth");
  const pathname = usePathname();

  const avatarLetter = email ? email[0].toUpperCase() : "?";

  const content = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        py: 2,
        px: 1.5,
        overflow: "hidden",
      }}
    >
      {/* Logo */}
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
        <Image src="/sealion.svg" alt="Sealion" width={28} height={28} />
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "1.1rem",
            letterSpacing: "-0.02em",
            color: "text.primary",
          }}
        >
          Sealion
        </Typography>
      </Box>

      {/* Nav items — plain list, no flex layout on the List itself */}
      <List disablePadding sx={{ flexGrow: 1 }}>
        <ListItemButton
          component={Link}
          href="/"
          selected={pathname === "/"}
          onClick={variant === "temporary" ? onClose : undefined}
          sx={{
            borderRadius: "8px",
            mb: 0.5,
            px: 1.5,
            py: 0.875,
            "&.Mui-selected": {
              bgcolor: "#eef2ff",
              color: "primary.main",
              "& .MuiListItemIcon-root": { color: "primary.main" },
              "&:hover": { bgcolor: "#e0e7ff" },
            },
            "&:hover": { bgcolor: "#f1f5f9" },
          }}
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
          sx={{
            borderRadius: "8px",
            mb: 0.5,
            px: 1.5,
            py: 0.875,
            color: "text.secondary",
            "&.Mui-selected": {
              bgcolor: "#eef2ff",
              color: "primary.main",
              "& .MuiListItemIcon-root": { color: "primary.main" },
              "&:hover": { bgcolor: "#e0e7ff" },
            },
            "&:hover": { bgcolor: "#f1f5f9" },
          }}
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
          sx={{
            borderRadius: "8px",
            mb: 0.5,
            px: 1.5,
            py: 0.875,
            color: "text.secondary",
            "&.Mui-selected": {
              bgcolor: "#eef2ff",
              color: "primary.main",
              "& .MuiListItemIcon-root": { color: "primary.main" },
              "&:hover": { bgcolor: "#e0e7ff" },
            },
            "&:hover": { bgcolor: "#f1f5f9" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <TuneIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t("boardSettings")}
            primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: pathname === "/settings/board" ? 600 : 500 }}
          />
        </ListItemButton>
      </List>

      {/* User profile footer */}
      <Box
        sx={{
          flexShrink: 0,
          p: 1.5,
          bgcolor: "background.paper",
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Avatar
          sx={{
            width: 28,
            height: 28,
            bgcolor: "primary.main",
            fontSize: "0.75rem",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {avatarLetter}
        </Avatar>
        <Typography
          noWrap
          sx={{ flex: 1, fontSize: "0.8rem", fontWeight: 600, color: "text.primary", minWidth: 0 }}
        >
          {email}
        </Typography>
        <Link href="/settings/providers">
          <IconButton
            size="small"
            aria-label={t("settings")}
            sx={{ color: "text.secondary", p: 0.5 }}
          >
            <SettingsIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Link>
        <IconButton
          size="small"
          aria-label={tAuth("logout")}
          onClick={() => signOut({ callbackUrl: "/login" })}
          sx={{ color: "text.secondary", p: 0.5 }}
        >
          <LogoutIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <Drawer
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
