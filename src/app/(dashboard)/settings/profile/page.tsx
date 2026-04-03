"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/hooks/usePageHeader";

/**
 * Profile settings page.
 *
 * Renders a username change form and a password change form. The username form
 * submits to `PATCH /api/account/profile`; the password form submits to
 * `PATCH /api/account/password`. On success, each form shows an inline success
 * message without redirecting.
 */
export default function ProfileSettingsPage() {
  const t = useTranslations("profileSettings");
  usePageHeader(t("title"), undefined, AccountCircleIcon);

  const [username, setUsername] = useState("");
  const [isUsernameLoading, setIsUsernameLoading] = useState(true);
  const [usernameLoadError, setUsernameLoadError] = useState<string | null>(null);
  const [isUsernameSubmitting, setIsUsernameSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/account/profile")
      .then(async (res) => {
        const json = (await res.json()) as { data: { username: string | null } | null; error: string | null };
        if (!res.ok || !json.data) {
          throw new Error(json.error ?? "load failed");
        }
        return json;
      })
      .then((json) => {
        setUsername(json.data?.username ?? "");
        setIsUsernameLoading(false);
      })
      .catch(() => {
        setUsernameLoadError(t("usernameLoadError"));
        // Keep isUsernameLoading=true so the form remains disabled
      });
  }, [t]);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameSuccess(null);
    setUsernameError(null);

    setIsUsernameSubmitting(true);
    try {
      const body = username.trim() === "" ? null : username.trim();
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: body }),
      });

      const json = (await response.json()) as { data: null; error: string | null };

      if (!response.ok || json.error) {
        if (json.error === "USERNAME_TOO_LONG") {
          setUsernameError(t("usernameErrorTooLong"));
        } else {
          setUsernameError(t("usernameErrorUnexpected"));
        }
      } else {
        setUsernameSuccess(t("usernameSuccess"));
        setUsername(body ?? "");
      }
    } catch {
      setUsernameError(t("usernameErrorUnexpected"));
    } finally {
      setIsUsernameSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError(t("errorCurrentRequired"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("errorTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("errorMismatch"));
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = (await response.json()) as { data: null; error: string | null };

      if (!response.ok || json.error) {
        if (json.error === "PASSWORD_INCORRECT") {
          setPasswordError(t("errorCurrentIncorrect"));
        } else {
          setPasswordError(t("errorUnexpected"));
        }
      } else {
        setPasswordSuccess(t("successMessage"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError(t("errorUnexpected"));
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        {t("changeUsername")}
      </Typography>

      <Box component="form" onSubmit={handleUsernameSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {usernameLoadError && (
          <Alert severity="error" data-testid="profile-username-load-error">
            {usernameLoadError}
          </Alert>
        )}
        {usernameSuccess && (
          <Alert severity="success" data-testid="profile-username-success-message">
            {usernameSuccess}
          </Alert>
        )}
        {usernameError && (
          <Alert severity="error" data-testid="profile-username-error-message">
            {usernameError}
          </Alert>
        )}

        <TextField
          data-testid="profile-username"
          label={t("username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth

          inputProps={{ maxLength: 50 }}
          disabled={isUsernameLoading}
        />

        <Button
          data-testid="profile-username-save-button"
          type="submit"
          variant="contained"
          disabled={isUsernameSubmitting || isUsernameLoading}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("saveChanges")}
        </Button>
      </Box>

      <Divider sx={{ my: 5 }} />

      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        {t("changePassword")}
      </Typography>

      <Box component="form" onSubmit={handlePasswordSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {passwordSuccess && (
          <Alert severity="success" data-testid="profile-success-message">
            {passwordSuccess}
          </Alert>
        )}
        {passwordError && (
          <Alert severity="error" data-testid="profile-error-message">
            {passwordError}
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
          disabled={isPasswordSubmitting}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("saveChanges")}
        </Button>
      </Box>
    </Container>
  );
}
