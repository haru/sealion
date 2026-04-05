"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/** Props for the {@link PageHeader} component. */
export interface PageHeaderProps {
  /** Page title text displayed on the left side of the titlebar. */
  title: string;
  /** Optional icon component rendered to the left of the title. */
  icon?: React.ElementType | null;
  /**
   * Optional custom content rendered in the right slot alongside the account menu.
   * Pass `null` or omit to leave the page-specific right slot empty.
   */
  actions?: React.ReactNode;
  /**
   * Account menu component rendered at the far-right edge of the titlebar.
   * Always visible on every authenticated page.
   */
  accountMenu?: React.ReactNode;
  /**
   * Optional React node rendered immediately after the title text in the left area.
   * Used for compact status chips such as the sync status indicator.
   */
  titleAddon?: React.ReactNode;
}

/**
 * Shared titlebar rendered at the top of every dashboard page on desktop (md+).
 * Hidden on mobile (xs–sm) where the hamburger AppBar is shown instead.
 *
 * @param props - Title, optional leading icon, optional right-slot actions, optional title-area addon, and optional account menu.
 * @returns A fixed-height header bar with a left title area and optional right content.
 */
export default function PageHeader({ title, icon, actions, accountMenu, titleAddon }: PageHeaderProps) {
  return (
    <Box
      data-testid="page-header"
      sx={{
        height: 56,
        borderBottom: "1px solid",
        borderColor: "divider",
        display: { xs: "none", md: "flex" },
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        flexShrink: 0,
      }}
    >
      <Box data-testid="page-header-title" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {icon != null && (
          <Box component={icon} sx={{ fontSize: 18, color: "text.secondary", display: "flex" }} />
        )}
        <Typography component="h1" sx={{ fontWeight: 600, fontSize: "0.9rem", color: "text.primary" }}>
          {title}
        </Typography>
        {titleAddon}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {actions != null && (
          <Box data-testid="page-header-actions" sx={{ display: "flex", alignItems: "center" }}>
            {actions}
          </Box>
        )}
        {accountMenu}
      </Box>
    </Box>
  );
}
