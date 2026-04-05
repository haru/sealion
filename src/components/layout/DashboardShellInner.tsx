"use client";

import MenuIcon from "@mui/icons-material/Menu";
import { useMediaQuery, useTheme } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import AccountMenu from "@/components/layout/AccountMenu";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar from "@/components/layout/Sidebar";
import { usePageHeaderContext } from "@/contexts/PageHeaderContext";

/** Height of the mobile AppBar in pixels, shared between the AppBar and the main content top offset. */
const APP_BAR_HEIGHT = 56;

/** Props for {@link DashboardShellInner}. */
export interface DashboardShellInnerProps {
  /** Authenticated user's email address, forwarded to the {@link Sidebar} profile footer. */
  email: string;
  /** Authenticated user's role, used to conditionally show admin navigation. */
  role: string;
  /** Page content rendered inside the main scrollable area. */
  children: React.ReactNode;
}

/**
 * Inner shell that reads the current page header from context and renders layout.
 * Kept separate so it can consume `PageHeaderContext` provided by the outer wrapper.
 */
export default function DashboardShellInner({ email, role, children }: DashboardShellInnerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tA11y = useTranslations("a11y");
  const { title, actions, icon, titleAddon } = usePageHeaderContext();

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Mobile-only AppBar for hamburger menu */}
      {isMobile && (
        <AppBar position="fixed">
          <Toolbar>
            <IconButton
              aria-label={tA11y("openMenu")}
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1, color: "text.secondary" }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "6px",
                  bgcolor: "primary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  flexShrink: 0,
                }}
              >
                S
              </Box>
              <Typography sx={{ color: "text.primary", fontWeight: 700, fontSize: "1rem" }}>
                Sealion
              </Typography>
            </Link>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar — permanent on desktop (participates in flex flow), temporary on mobile */}
      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant={isMobile ? "temporary" : "permanent"}
        isAdmin={role === "ADMIN"}
      />

      {/* Main content — fills remaining width */}
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: "auto",
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          ...(isMobile && { mt: `${APP_BAR_HEIGHT}px` }),
        }}
      >
        <PageHeader title={title} icon={icon} actions={actions} titleAddon={titleAddon} accountMenu={<AccountMenu email={email} />} />
        {children}
      </Box>
    </Box>
  );
}
