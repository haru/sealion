/**
 * Re-signs in the current browser after the user changes their own password.
 * The server revokes every session on a password change, so this keeps only this one alive.
 */

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback } from "react";

/**
 * Returns a function that replaces the (now revoked) session with a fresh one.
 *
 * The server keeps no "keep this session" exception that a client could spoof (ADR 0006);
 * instead the browser signs in again with the new password. If that fails for any reason the
 * router is refreshed, and the server layout then redirects to the login page.
 *
 * @returns An async function taking the user's email and the new password.
 */
export function useReauthAfterPasswordChange(): (email: string, newPassword: string) => Promise<void> {
  const router = useRouter();

  return useCallback(
    async (email: string, newPassword: string): Promise<void> => {
      try {
        const result = await signIn("credentials", { email, password: newPassword, redirect: false });
        if (!result || result.error) { router.refresh(); }
      } catch {
        router.refresh();
      }
    },
    [router],
  );
}
