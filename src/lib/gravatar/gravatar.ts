import md5 from "md5";

/**
 * Returns the Gravatar image URL for the given email address.
 *
 * @param email - The user's email address (trimmed and lowercased internally).
 * @param size  - Desired image size in pixels (default 32).
 * @returns     Full Gravatar URL with `d=404` so missing avatars return HTTP 404.
 */
export function getGravatarUrl(email: string, size = 32): string {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
