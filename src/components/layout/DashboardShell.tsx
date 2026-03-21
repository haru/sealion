"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import Link from "next/link";
import { SignOutButton } from "@/components/ui/SignOutButton";
import Sidebar from "@/components/layout/Sidebar";
import { useMediaQuery, useTheme } from "@mui/material";
import { useTranslations } from "next-intl";

interface DashboardShellProps {
  email: string;
  children: React.ReactNode;
}

/** Top-level authenticated shell with app bar, sidebar, and main content area. */
export default function DashboardShell({ email, children }: DashboardShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const t = useTranslations("auth");

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open menu"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Link href="/" style={{ flexGrow: 1, color: "inherit", textDecoration: "none" }}>
            <Typography variant="h6" sx={{ color: "inherit" }}>
              Sealion
            </Typography>
          </Link>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {email}
          </Typography>
          <Link href="/settings/providers">
            <IconButton color="inherit" aria-label="settings">
              <SettingsIcon />
            </IconButton>
          </Link>
          <SignOutButton label={t("logout")} />
        </Toolbar>
      </AppBar>

      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant={isMobile ? "temporary" : "permanent"}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: "64px",
          minHeight: "100vh",
        }}
      >
        {children}
      </Box>

      {/* Spacer that mirrors sidebar width to center content on the full viewport */}
      <Box sx={{ display: { xs: "none", md: "block" }, width: 240, flexShrink: 0 }} />
    </Box>
  );
}
