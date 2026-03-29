"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/hooks/usePageHeader";

/**
 * Profile settings page.
 *
 * Renders a password change form with three fields: current password, new password,
 * and confirmation. Validates locally before submitting to `PATCH /api/account/password`.
 * On success, shows an inline success message without redirecting.
 */
export default function ProfileSettingsPage() {
  const t = useTranslations("profileSettings");
  usePageHeader(t("title"));

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Client-side validation
    if (!currentPassword) {
      setErrorMessage(t("errorCurrentRequired"));
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage(t("errorTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage(t("errorMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = (await response.json()) as { data: null; error: string | null };

      if (!response.ok || json.error) {
        // Map server-side error codes to localized messages.
        // Falling back to errorUnexpected prevents raw English server strings
        // from leaking into non-en locales.
        if (json.error === "PASSWORD_INCORRECT") {
          setErrorMessage(t("errorCurrentIncorrect"));
        } else {
          setErrorMessage(t("errorUnexpected"));
        }
      } else {
        setSuccessMessage(t("successMessage"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setErrorMessage(t("errorUnexpected"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        {t("changePassword")}
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {successMessage && (
          <Alert severity="success" data-testid="profile-success-message">
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert severity="error" data-testid="profile-error-message">
            {errorMessage}
          </Alert>
        )}

        <TextField
          data-testid="profile-current-password"
          label={t("currentPassword")}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          fullWidth
          required
          autoComplete="current-password"
        />

        <TextField
          data-testid="profile-new-password"
          label={t("newPassword")}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          fullWidth
          required
          autoComplete="new-password"
        />

        <TextField
          data-testid="profile-confirm-password"
          label={t("confirmPassword")}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          fullWidth
          required
          autoComplete="new-password"
        />

        <Button
          data-testid="profile-save-button"
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("saveChanges")}
        </Button>
      </Box>
    </Container>
  );
}
