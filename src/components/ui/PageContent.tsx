"use client";

import Box from "@mui/material/Box";

/** Available max-width presets for page content areas. */
type MaxWidthPreset = "xs" | "sm" | "md" | "lg" | "xl";

/** Maps maxWidth presets to pixel values for Box usage. */
const MAX_WIDTH_MAP: Record<MaxWidthPreset, number> = {
  xs: 444,
  sm: 600,
  md: 960,
  lg: 1200,
  xl: 1536,
};

/** Props for the {@link PageContent} component. */
export interface PageContentProps {
  /** The content to render inside the page area. */
  children: React.ReactNode;
  /**
   * Maximum width preset for the content area.
   * Defaults to `"lg"`.
   */
  maxWidth?: MaxWidthPreset;
}

/**
 * Shared page content wrapper that provides consistent horizontal padding,
 * vertical spacing, and max-width constraint across all dashboard pages.
 *
 * Replaces per-page `<Container maxWidth="..." sx={{ py: 4 }}>` usage
 * to ensure visual consistency.
 *
 * @param props - {@link PageContentProps}
 * @returns A centered, padded content area.
 */
export default function PageContent({ children, maxWidth = "lg" }: PageContentProps) {
  return (
    <Box
      sx={{
        maxWidth: MAX_WIDTH_MAP[maxWidth],
        mx: "auto",
        py: 4,
        px: 3,
        width: "100%",
      }}
    >
      {children}
    </Box>
  );
}
