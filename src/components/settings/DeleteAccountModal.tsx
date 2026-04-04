"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";

/** Props for the DeleteAccountModal component. */
interface DeleteAccountModalProps {
  /** Whether the modal is currently open. */
  open: boolean;
  /** The authenticated user's email address used for confirmation. */
  userEmail: string;
  /** Callback invoked when the user closes or cancels the modal. */
  onClose: () => void;
}

/**
 * Confirmation modal for account self-deletion.
 *
 * The user must type their email address exactly to confirm deletion.
 * On success, `DELETE /api/account/me` is called and then `signOut()` is
 * invoked to invalidate the session and redirect to the login page.
 *
 * @param props - Modal props (open state, user email, close callback).
 * @returns The rendered MUI Dialog element.
 */
export function DeleteAccountModal({ open, userEmail, onClose }: DeleteAccountModalProps) {
  const t = useTranslations("profileSettings.dangerZone.modal");

  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setEmailInput("");
    setEmailError(null);
    onClose();
  };

  const handleConfirm = async () => {
    setEmailError(null);

    if (emailInput.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setEmailError(t("emailMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/account/me", { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error: string | null };
        // Map server error codes to localized user-facing messages.
        if (json.error === "LAST_ADMIN") {
          setEmailError(t("errorLastAdmin"));
        } else if (json.error === "UNAUTHORIZED") {
          setEmailError(t("errorUnauthorized"));
        } else {
          setEmailError(t("errorUnexpected"));
        }
        return;
      }
      // Session invalidation and redirect to login
      await signOut({ callbackUrl: "/login" });
    } catch {
      setEmailError(t("errorUnexpected"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      data-testid="delete-account-modal"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t("title")}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t("description")}</DialogContentText>

        {emailError && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="delete-account-email-error">
            {emailError}
          </Alert>
        )}

        <TextField
          data-testid="delete-account-email-input"
          label={t("emailLabel")}
          placeholder={t("emailPlaceholder")}
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          fullWidth
          disabled={isSubmitting}
          autoComplete="off"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          data-testid="delete-account-cancel-button"
          onClick={handleClose}
          disabled={isSubmitting}
        >
          {t("cancel")}
        </Button>
        <Button
          data-testid="delete-account-confirm-button"
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
