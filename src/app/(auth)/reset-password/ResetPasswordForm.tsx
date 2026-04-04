"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthCard } from "@/components/ui/AuthCard";

/**
 * Client component for the password reset email request form.
 *
 * Submits the user's email to `POST /api/auth/reset-password`. On success,
 * displays an informational message. Handles rate limit (429) and server (5xx)
 * errors with appropriate alerts.
 */
export function ResetPasswordForm() {
  const t = useTranslations("resetPassword");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Submits the email to request a password reset link. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setRateLimited(false);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        return;
      }

      if (!res.ok) {
        setError(t("generalError"));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("generalError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      <Typography variant="h5" component="h2" fontWeight="700" textAlign="center" gutterBottom sx={{ mb: 3 }}>
        {t("title")}
      </Typography>

      {success && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          {t("successMessage")}
        </Alert>
      )}

      {rateLimited && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {t("rateLimitError")}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {!success && (
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <TextField
            label={t("emailLabel")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
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
            {t("submit")}
          </Button>
        </Box>
      )}
    </AuthCard>
  );
}
