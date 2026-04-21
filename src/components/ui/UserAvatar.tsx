"use client";

import Avatar from "@mui/material/Avatar";
import { useState } from "react";

import { getGravatarUrl } from "@/lib/gravatar/gravatar";

/** Props for the {@link UserAvatar} component. */
export interface UserAvatarProps {
  /** User's email address — used for initial derivation and Gravatar URL generation. */
  email: string;
  /** Whether to attempt displaying the Gravatar image. */
  useGravatar: boolean;
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
 * When `useGravatar` is true, attempts to load the Gravatar image; falls back to
 * the email initial on error (e.g., HTTP 404 for unregistered emails).
 *
 * @param props - Component props.
 * @returns MUI Avatar with Gravatar image or email initial.
 */
export default function UserAvatar({ email, useGravatar, size = 32 }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const initial = deriveInitial(email);

  const avatarSx = {
    width: size,
    height: size,
    bgcolor: "primary.main",
    fontSize: `${size * 0.025}rem`,
    fontWeight: 600,
  };

  if (useGravatar && !imgError) {
    return (
      <Avatar
        src={getGravatarUrl(email, size)}
        sx={avatarSx}
        imgProps={{ onError: () => setImgError(true) }}
      >
        {initial}
      </Avatar>
    );
  }

  return (
    <Avatar sx={avatarSx}>
      {initial}
    </Avatar>
  );
}
