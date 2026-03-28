"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { useMediaQuery, useTheme } from "@mui/material";
import { useTranslations } from "next-intl";
import { MessageQueueProvider } from "@/components/MessageQueue";

/** Height of the mobile AppBar in pixels, shared between the AppBar and the main content top offset. */
const APP_BAR_HEIGHT = 56;

/** Props for {@link DashboardShell}. */
interface DashboardShellProps {
  /** Authenticated user's email address, forwarded to the {@link Sidebar} profile footer. */
  email: string;
  /** Page content rendered inside the main scrollable area. */
  children: React.ReactNode;
}

/** Top-level authenticated shell with sidebar and main content area. */
export default function DashboardShell({ email, children }: DashboardShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tA11y = useTranslations("a11y");

  return (
    <MessageQueueProvider>
      <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* Mobile-only AppBar for hamburger menu */}
        {isMobile && (
          <AppBar position="fixed" sx={{ display: { md: "none" } }}>
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
          email={email}
        />

        {/* Main content — fills remaining width */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: "auto",
            bgcolor: "background.paper",
            ...(isMobile && { mt: `${APP_BAR_HEIGHT}px` }),
          }}
        >
          {children}
        </Box>
      </Box>
    </MessageQueueProvider>
  );
}
