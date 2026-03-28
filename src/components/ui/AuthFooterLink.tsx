"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "next/link";

/** Props for the {@link AuthFooterLink} component. */
export interface AuthFooterLinkProps {
  /** Descriptive text shown before the link (e.g. "Don't have an account?"). */
  prompt: string;
  /** The Next.js href for the link destination. */
  href: string;
  /** The visible link label (e.g. "Sign up"). */
  label: string;
}

/**
 * Footer navigation link shared by auth pages (login → signup and signup → login).
 *
 * Renders a centred line of muted body text with an inline primary-coloured link.
 * The link exposes an underline on both `:hover` and `:focus-visible` so keyboard
 * users receive the same visual affordance as pointer users.
 *
 * @param props - {@link AuthFooterLinkProps}
 * @returns A Typography paragraph containing a styled navigation link.
 */
export function AuthFooterLink({ prompt, href, label }: AuthFooterLinkProps) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mt: 4, mb: 1, textAlign: "center" }}
    >
      {prompt}{" "}
      <Link href={href} style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}>
        <Box
          component="span"
          sx={{
            color: "primary.main",
            "&:hover": { textDecoration: "underline" },
            "&:focus-visible": { textDecoration: "underline" },
          }}
        >
          {label}
        </Box>
      </Link>
    </Typography>
  );
}
