"use client";

import Avatar from "@mui/material/Avatar";

import GravatarImage from "@/components/ui/GravatarImage";

/** Props for the {@link UserAvatar} component. */
export interface UserAvatarProps {
  /** User's email address — used for initial derivation. */
  email: string;
  /** Pre-computed Gravatar URL. When provided, attempts to display the image; falls back to initial on error. */
  gravatarUrl?: string;
  /** Avatar diameter in pixels. Defaults to 32. */
  size?: number;
}

/** Derives the display initial from an email address — first char of local part, uppercased, or "?". */
function deriveInitial(email: string): string {
  const localPart = email ? email.split("@")[0] : "";
  return localPart.length > 0 ? localPart[0].toUpperCase() : "?";
}

/**
 * Reusable avatar component that displays a Gravatar image or an email initial.
 *
 * When `gravatarUrl` is provided, attempts to load the image; falls back to
 * the email initial on error (e.g., HTTP 404 for unregistered emails).
 *
 * @param props - Component props.
 * @returns MUI Avatar with Gravatar image or email initial.
 */
export default function UserAvatar({ email, gravatarUrl, size = 32 }: UserAvatarProps) {
  const initial = deriveInitial(email);

  const avatarSx = {
    width: size,
    height: size,
    bgcolor: "primary.main",
    fontSize: `${size * 0.025}rem`,
    fontWeight: 600,
  };

  if (gravatarUrl) {
    return <GravatarImage key={gravatarUrl} src={gravatarUrl} initial={initial} sx={avatarSx} />;
  }

  return <Avatar sx={avatarSx}>{initial}</Avatar>;
}
