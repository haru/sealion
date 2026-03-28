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
import { MessageQueueProvider } from "@/components/MessageQueue";

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
  const tA11y = useTranslations("a11y");

  return (
    <MessageQueueProvider>
      <Box sx={{ display: "flex" }}>
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar>
            {isMobile && (
              <IconButton
                aria-label={tA11y("openMenu")}
                edge="start"
                onClick={() => setDrawerOpen(true)}
                sx={{ mr: 1, color: "text.secondary" }}
              >
                <MenuIcon fontSize="small" />
              </IconButton>
            )}
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexGrow: 1 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "7px",
                  bgcolor: "primary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                S
              </Box>
              <Typography
                variant="body1"
                sx={{
                  color: "text.primary",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  letterSpacing: "-0.01em",
                }}
              >
                Sealion
              </Typography>
            </Link>
            <Typography
              variant="body2"
              sx={{
                mr: 1,
                color: "text.secondary",
                fontSize: "0.8125rem",
                display: { xs: "none", sm: "block" },
              }}
            >
              {email}
            </Typography>
            <Link href="/settings/providers">
              <IconButton
                aria-label={tA11y("settings")}
                sx={{ color: "text.secondary" }}
              >
                <SettingsIcon fontSize="small" />
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
            mt: "56px",
            minHeight: "100vh",
            bgcolor: "background.default",
          }}
        >
          {children}
        </Box>

        {/* Spacer that mirrors sidebar width to center content on the full viewport */}
        <Box sx={{ display: { xs: "none", md: "block" }, width: 240, flexShrink: 0 }} />
      </Box>
    </MessageQueueProvider>
  );
}
