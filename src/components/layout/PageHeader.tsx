"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/** Props for the {@link PageHeader} component. */
export interface PageHeaderProps {
  /** Page title text displayed on the left side of the titlebar. */
  title: string;
  /**
   * Optional custom content rendered in the right slot.
   * Pass `null` or omit to leave the right side empty.
   */
  actions?: React.ReactNode;
}

/**
 * Shared titlebar rendered at the top of every dashboard page on desktop (md+).
 * Hidden on mobile (xs–sm) where the hamburger AppBar is shown instead.
 *
 * @param props - Title and optional right-slot actions.
 * @returns A fixed-height header bar with a left title and optional right content.
 */
export default function PageHeader({ title, actions }: PageHeaderProps) {
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
      <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", color: "text.primary" }}>
        {title}
      </Typography>
      {actions != null && (
        <Box data-testid="page-header-actions" sx={{ display: "flex", alignItems: "center" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
