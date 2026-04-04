"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { SetPasswordForm } from "./SetPasswordForm";

/**
 * Password reset confirm page — client component.
 *
 * Reads the `token` from query parameters. If missing, redirects to the
 * result page with a `missing_token` error. Otherwise renders the new
 * password form.
 */
export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      router.replace("/reset-password/result?error=missing_token");
    }
  }, [token, router]);

  if (!token) {
    return null;
  }

  return <SetPasswordForm token={token} />;
}
