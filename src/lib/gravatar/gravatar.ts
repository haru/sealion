import { createHash } from "crypto";

/**
 * Returns the Gravatar image URL for the given email address.
 *
 * @param email - The user's email address (trimmed and lowercased internally).
 * @param size  - Desired image size in pixels (default 32).
 * @returns     Full Gravatar URL with `d=404` so missing avatars return HTTP 404.
 */
export function getGravatarUrl(email: string, size = 32): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
