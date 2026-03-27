"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { useTranslations } from "next-intl";
import ProviderForm, { type ProviderFormData } from "@/components/providers/ProviderForm";

interface AddProviderDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close (cancel, Esc, or backdrop click). */
  onClose: () => void;
  /**
   * Called to submit a new provider.
   * @param data - The provider form data.
   * @throws When the API call fails; the error is surfaced inside the form.
   */
  onSubmit: (data: ProviderFormData) => Promise<void>;
}

/**
 * Modal dialog for adding a new issue provider.
 * Wraps {@link ProviderForm} in an MUI Dialog.
 * On successful submit, calls `onClose()`; on cancel or Esc/overlay, also calls `onClose()`.
 */
export default function AddProviderDialog({ open, onClose, onSubmit }: AddProviderDialogProps) {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");

  /** Wraps `onSubmit` to close the dialog on success. */
  async function handleSubmit(data: ProviderFormData) {
    // Let ProviderForm catch and display API errors — only close on success
    await onSubmit(data);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t("addProviderTitle")}</DialogTitle>
      <DialogContent>
        <ProviderForm onSubmit={handleSubmit} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tCommon("cancel")}</Button>
      </DialogActions>
    </Dialog>
  );
}
