"use client";

import Avatar from "@mui/material/Avatar";
import { useState } from "react";

/** Props for the {@link GravatarImage} component. */
export interface GravatarImageProps {
  /** Pre-computed Gravatar URL to display. */
  src: string;
  /** Fallback initial to show on error. */
  initial: string;
  /** MUI Avatar style object. */
  sx: Record<string, unknown>;
}

/**
 * Inner component that renders a Gravatar image with error fallback.
 *
 * Extracted so the parent can remount it via `key={gravatarUrl}` whenever
 * the URL changes, automatically resetting the error state.
 */
export default function GravatarImage({ src, initial, sx }: GravatarImageProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return <Avatar sx={sx}>{initial}</Avatar>;
  }

  return (
    <Avatar src={src} sx={sx} slotProps={{ img: { onError: () => setImgError(true) } }}>
      {initial}
    </Avatar>
  );
}
