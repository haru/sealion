"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";

/** Props for the {@link AuthCard} component. */
export interface AuthCardProps {
  /** The form content to render inside the card. */
  children: React.ReactNode;
}

/**
 * Shared card container used by all authentication pages (login, signup).
 * Provides consistent box-shadow, border-radius, and padding across auth forms.
 *
 * @param props - {@link AuthCardProps}
 * @returns A styled MUI Card with standard auth page appearance.
 */
export function AuthCard({ children }: AuthCardProps) {
  return (
    <Card
      elevation={0}
      sx={{
        width: "100%",
        borderRadius: 4,
        boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: { xs: 4, sm: 5 } }}>{children}</CardContent>
    </Card>
  );
}
