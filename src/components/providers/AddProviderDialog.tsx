"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { useTranslations } from "next-intl";
import ProviderForm from "@/components/providers/ProviderForm";

interface AddProviderDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /**
   * Called when the dialog should close.
   * @param added - `true` if a provider was successfully added, `false` if cancelled.
   */
  onClose: (added: boolean) => void;
  /**
   * Called to submit a new provider.
   * @param data - The provider form data.
   * @throws When the API call fails; the error is surfaced inside the form.
   */
  onSubmit: (data: {
    type: "GITHUB" | "JIRA" | "REDMINE";
    displayName: string;
    credentials: Record<string, string>;
  }) => Promise<void>;
}

/**
 * Modal dialog for adding a new issue provider.
 * Wraps {@link ProviderForm} in an MUI Dialog.
 * On successful submit, calls `onClose(true)`; on cancel or Esc/overlay, calls `onClose(false)`.
 */
export default function AddProviderDialog({ open, onClose, onSubmit }: AddProviderDialogProps) {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");

  /**
   * Wraps `onSubmit` to close the dialog on success.
   * @param data - Provider form data passed from ProviderForm.
   */
  async function handleSubmit(data: {
    type: "GITHUB" | "JIRA" | "REDMINE";
    displayName: string;
    credentials: Record<string, string>;
  }) {
    // Let ProviderForm catch and display API errors — only close on success
    await onSubmit(data);
    onClose(true);
  }

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t("addProviderTitle")}</DialogTitle>
      <DialogContent>
        <ProviderForm onSubmit={handleSubmit} />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>{tCommon("cancel")}</Button>
      </DialogActions>
    </Dialog>
  );
}
