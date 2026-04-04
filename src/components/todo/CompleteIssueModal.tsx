"use client";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Props for {@link CompleteIssueModal}. */
export interface CompleteIssueModalProps {
  /** Controls whether the dialog is visible. */
  open: boolean;
  /** Internal ID of the issue to close. */
  issueId: string;
  /**
   * Called when the user confirms the close action.
   * Receives the issue ID and the (possibly empty) comment string.
   * @param issueId - Internal ID of the issue.
   * @param comment - Completion reason entered by the user.
   * @returns A promise that resolves on success or rejects on failure.
   */
  onConfirm: (issueId: string, comment: string) => Promise<void>;
  /** Called when the user cancels the dialog. */
  onCancel: () => void;
}

/**
 * Modal dialog for completing (closing) an issue with an optional reason.
 * Displays a textarea for the completion reason and Complete / Cancel buttons.
 * Shows an inline error on API failure and keeps the modal open for retry.
 */
export default function CompleteIssueModal({
  open,
  issueId,
  onConfirm,
  onCancel,
}: CompleteIssueModalProps) {
  const t = useTranslations("completeModal");

  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Resets internal state when the dialog closes. */
  function handleCancel() {
    if (loading) { return; }
    setComment("");
    setError(null);
    onCancel();
  }

  /** Calls onConfirm, handles loading / error states, and resets on success. */
  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(issueId, comment);
      setComment("");
      setError(null);
    } catch {
      setError(t("errorMessage"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t("title")}</DialogTitle>

      <DialogContent>
        <TextField
          label={t("reasonLabel")}
          placeholder={t("reasonPlaceholder")}
          multiline
          rows={4}
          fullWidth
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={loading}
          inputProps={{ maxLength: 1000 }}
          sx={{ mt: 1 }}
        />

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={loading}>
          {t("cancelButton")}
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("confirmButton")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
