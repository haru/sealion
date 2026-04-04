"use client";

import {
  Box,
  Collapse,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import TuneIcon from "@mui/icons-material/Tune";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PeopleIcon from "@mui/icons-material/People";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { version } from "../../../package.json";

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

/**
 * Navigation drawer with logo and links to main sections.
 * @param props - Sidebar props controlling open state, close callback, drawer variant, and admin flag.
 * @returns A MUI Drawer rendered as permanent on desktop and temporary on mobile.
 */
export default function Sidebar({ open, onClose, variant, isAdmin }: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith("/admin"));

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

        {/* Admin-only: System Administration submenu */}
        {isAdmin && (
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
                  sx={{
                    borderRadius: "8px",
                    mb: 0.5,
                    pl: 3.5,
                    pr: 1.5,
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
                  sx={{
                    borderRadius: "8px",
                    mb: 0.5,
                    pl: 3.5,
                    pr: 1.5,
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
                  sx={{
                    borderRadius: "8px",
                    mb: 0.5,
                    pl: 3.5,
                    pr: 1.5,
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
        )}
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
