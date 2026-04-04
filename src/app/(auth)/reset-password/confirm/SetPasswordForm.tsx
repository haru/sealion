"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { AuthCard } from "@/components/ui/AuthCard";
import { AuthFooterLink } from "@/components/ui/AuthFooterLink";

/** Props for {@link SetPasswordForm}. */
interface SetPasswordFormProps {
  /** The password reset token from the URL query parameter. */
  token: string;
}

/**
 * Client component for setting a new password during password reset.
 *
 * Submits the new password and confirm password to `POST /api/auth/reset-password/confirm`.
 * Redirects to the result page on success or error.
 */
export function SetPasswordForm({ token }: SetPasswordFormProps) {
  const t = useTranslations("resetPassword");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResendLink, setShowResendLink] = useState(false);

  /** Submits the new password to the confirm endpoint. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowResendLink(false);

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      setLoading(false);
      return;
    }

    if (password.length > 72) {
      setError(t("passwordTooLong"));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      if (res.ok) {
        router.push("/reset-password/result?status=success");
        return;
      }

      const json = await res.json();

      if (res.status === 410) {
        setShowResendLink(true);
        const errorCode = json.error === "EXPIRED_TOKEN" ? "expired_token" : "invalid_token";
        router.push(`/reset-password/result?error=${errorCode}`);
        return;
      }

      if (res.status === 403) {
        router.push("/reset-password/result?error=suspended");
        return;
      }

      if (res.status === 404) {
        router.push("/reset-password/result?error=invalid_token");
        return;
      }

      setError(json.error ?? t("generalError"));
    } catch {
      setError(t("generalError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      <Typography variant="h5" component="h2" fontWeight="700" textAlign="center" gutterBottom sx={{ mb: 3 }}>
        {t("confirmTitle")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <TextField
          label={t("passwordLabel")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          autoComplete="new-password"
          variant="outlined"
        />
        <TextField
          label={t("confirmPasswordLabel")}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          fullWidth
          autoComplete="new-password"
          variant="outlined"
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={loading}
          sx={{
            mt: 1,
            py: 1.5,
            borderRadius: 2,
            fontWeight: "bold",
            textTransform: "none",
            fontSize: "1rem",
          }}
        >
          {t("confirmSubmit")}
        </Button>
      </Box>

      {showResendLink && (
        <AuthFooterLink prompt="" href="/reset-password" label={t("requestNewLink")} />
      )}
    </AuthCard>
  );
}
