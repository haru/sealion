"use client";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useRef } from "react";

import { DeleteAccountModal } from "@/components/settings/DeleteAccountModal";
import GravatarSection from "@/components/settings/GravatarSection";
import { usePageHeader } from "@/hooks/usePageHeader";

/**
 * Profile settings page.
 *
 * Single unified form that saves username, Gravatar preference, and optionally
 * a new password in one atomic request to PATCH /api/account/settings.
 */
export default function ProfileSettingsPage() {
  const t = useTranslations("profileSettings");
  const tErrors = useTranslations("errors");
  usePageHeader(t("title"), undefined, AccountCircleIcon);

  const router = useRouter();
  const { update } = useSession();

  // Profile data
  const [username, setUsername] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isLastAdmin, setIsLastAdmin] = useState(false);
  const [useGravatar, setUseGravatar] = useState(false);
  const initialUseGravatar = useRef(false);

  // Loading/save state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Password change state
  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/account/profile")
      .then(async (res) => {
        const json = (await res.json()) as {
          data: { username: string | null; email: string; isLastAdmin: boolean; useGravatar: boolean } | null;
          error: string | null;
        };
        if (!res.ok || !json.data) { throw new Error(json.error ?? "load failed"); }
        return json;
      })
      .then((json) => {
        setUsername(json.data?.username ?? "");
        setUserEmail(json.data?.email ?? "");
        setIsLastAdmin(json.data?.isLastAdmin ?? false);
        const gravatar = json.data?.useGravatar ?? false;
        setUseGravatar(gravatar);
        initialUseGravatar.current = gravatar;
        setIsLoading(false);
      })
      .catch(() => {
        setLoadError(t("usernameLoadError"));
        // Keep isLoading=true so form remains disabled
      });
  }, [t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(null);
    setSaveError(null);

    // Client-side confirmPassword validation (T011/VR-004)
    if (changePassword && confirmPassword !== newPassword) {
      setSaveError(t("errorMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const body = changePassword
        ? {
            username: username.trim() === "" ? null : username.trim(),
            useGravatar,
            changePassword: true as const,
            currentPassword,
            newPassword,
          }
        : {
            username: username.trim() === "" ? null : username.trim(),
            useGravatar,
            changePassword: false as const,
          };

      const response = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { data: null; error: string | null };

      if (!response.ok || json.error) {
        setSaveError(mapApiError(json.error, t, tErrors));
      } else {
        setSaveSuccess(t("settingsSaved"));

        // Clear password fields on success (FR-007)
        if (changePassword) {
          setChangePassword(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }

        // Refresh JWT session when Gravatar preference changed (FR-010, Decision 5)
        if (useGravatar !== initialUseGravatar.current) {
          await update({ useGravatar });
          initialUseGravatar.current = useGravatar;
          router.refresh();
        }
      }
    } catch {
      setSaveError(t("errorUnexpected"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePasswordToggle = (checked: boolean) => {
    setChangePassword(checked);
    if (!checked) {
      // Clear password fields when checkbox is unchecked (FR-007)
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box
        component="form"
        onSubmit={handleSave}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {loadError && (
          <Alert severity="error" data-testid="profile-load-error">
            {loadError}
          </Alert>
        )}
        {saveSuccess && (
          <Alert severity="success" data-testid="profile-save-success">
            {saveSuccess}
          </Alert>
        )}
        {saveError && (
          <Alert severity="error" data-testid="profile-save-error">
            {saveError}
          </Alert>
        )}

        {/* Username */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          {t("changeUsername")}
        </Typography>

        <TextField
          data-testid="profile-username"
          label={t("username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          inputProps={{ maxLength: 50 }}
          disabled={isLoading}
        />

        <Divider sx={{ my: 2 }} />

        {/* Gravatar */}
        <GravatarSection
          useGravatar={useGravatar}
          disabled={isLoading || isSubmitting}
          onChange={setUseGravatar}
        />

        <Divider sx={{ my: 2 }} />

        {/* Password change */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          {t("changePassword")}
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              data-testid="profile-change-password-checkbox"
              checked={changePassword}
              onChange={(e) => handleChangePasswordToggle(e.target.checked)}
              disabled={isLoading || isSubmitting}
            />
          }
          label={t("changePassword")}
        />

        <Collapse in={changePassword} unmountOnExit>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              data-testid="profile-current-password"
              label={t("currentPassword")}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
            />

            <TextField
              data-testid="profile-new-password"
              label={t("newPassword")}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
            />

            <TextField
              data-testid="profile-confirm-password"
              label={t("confirmPassword")}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
            />
          </Box>
        </Collapse>

        {/* Unified save button */}
        <Button
          data-testid="profile-save-button"
          type="submit"
          variant="contained"
          disabled={isSubmitting || isLoading}
          sx={{ alignSelf: "flex-start", mt: 1 }}
        >
          {t("saveSettings")}
        </Button>
      </Box>

      {!isLoading && !isLastAdmin && (
        <>
          <Divider sx={{ my: 5 }} />

          <Box data-testid="danger-zone-section" sx={{ border: "1px solid", borderColor: "error.main", borderRadius: 1, p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: "error.main" }}>
              {t("dangerZone.title")}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
              {t("dangerZone.deleteAccountDescription")}
            </Typography>
            <Button
              data-testid="delete-account-button"
              variant="outlined"
              color="error"
              onClick={() => setDeleteModalOpen(true)}
            >
              {t("dangerZone.deleteAccount")}
            </Button>
          </Box>

          <DeleteAccountModal
            open={deleteModalOpen}
            userEmail={userEmail}
            onClose={() => setDeleteModalOpen(false)}
          />
        </>
      )}
    </Container>
  );
}

/** Maps API error codes to localised messages. */
function mapApiError(
  errorCode: string | null,
  t: ReturnType<typeof useTranslations<"profileSettings">>,
  tErrors: ReturnType<typeof useTranslations<"errors">>
): string {
  switch (errorCode) {
    case "PASSWORD_CURRENT_REQUIRED": return tErrors("PASSWORD_CURRENT_REQUIRED");
    case "PASSWORD_TOO_SHORT": return tErrors("PASSWORD_TOO_SHORT");
    case "PASSWORD_INCORRECT": return tErrors("PASSWORD_INCORRECT");
    case "USERNAME_TOO_LONG": return tErrors("USERNAME_TOO_LONG");
    default: return t("errorUnexpected");
  }
}
