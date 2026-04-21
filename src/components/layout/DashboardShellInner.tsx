"use client";

import { useMediaQuery, useTheme } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Image from "next/image";
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
  /** Pre-computed Gravatar URL. When provided, displays the Gravatar image in the account menu. */
  gravatarUrl?: string;
  /** Page content rendered inside the main scrollable area. */
  children: React.ReactNode;
}

/**
 * Inner shell that reads the current page header from context and renders layout.
 * Kept separate so it can consume `PageHeaderContext` provided by the outer wrapper.
 */
export default function DashboardShellInner({ email, role, gravatarUrl, children }: DashboardShellInnerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tA11y = useTranslations("a11y");
  const { title, actions, icon, titleAddon, breadcrumbParent, breadcrumbParentIcon } = usePageHeaderContext();

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Mobile-only AppBar for hamburger menu */}
      {isMobile && (
        <AppBar position="fixed">
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <IconButton
                aria-label={tA11y("openMenu")}
                edge="start"
                onClick={() => setDrawerOpen(true)}
                sx={{ mr: 1 }}
              >
                <Image src="/sealion.svg" alt="Sealion" width={24} height={24} />
              </IconButton>
              {titleAddon}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {actions != null && actions}
              <AccountMenu email={email} gravatarUrl={gravatarUrl} />
            </Box>
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
        <PageHeader title={title} icon={icon} actions={actions} titleAddon={titleAddon} breadcrumbParent={breadcrumbParent} breadcrumbParentIcon={breadcrumbParentIcon} accountMenu={<AccountMenu email={email} gravatarUrl={gravatarUrl} />} />
        {children}
      </Box>
    </Box>
  );
}
