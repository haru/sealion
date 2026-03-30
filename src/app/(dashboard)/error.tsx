"use client";

import { Box, Button, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useTranslations } from "next-intl";

/** Props for the dashboard error boundary. */
interface DashboardErrorProps {
  /** The error that was thrown. */
  error: Error & { digest?: string };
  /** Resets the error boundary and re-renders the route segment. */
  reset: () => void;
}

/**
 * Error boundary for dashboard route segments.
 * Displays a user-friendly error message with a retry button.
 *
 * @param props - Error details and reset callback provided by Next.js.
 */
export default function DashboardError({ reset }: DashboardErrorProps) {
  const t = useTranslations("common");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        px: 3,
        textAlign: "center",
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 48, color: "error.main", mb: 2 }} />
      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("error")}
      </Typography>
      <Button variant="contained" onClick={reset} sx={{ mt: 2 }}>
        {t("retry")}
      </Button>
    </Box>
  );
}
