"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useMessageQueue } from "@/components/MessageQueue";

/** A user record as returned by GET /api/admin/users. */
interface UserRecord {
  id: string;
  email: string;
  username: string | null;
  role: "USER" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

/** Props for {@link EditUserDialog}. */
interface EditUserDialogProps {
  /** The user being edited. `null` means the dialog is closed. */
  user: UserRecord | null;
  /** Whether the target user is the currently logged-in admin (restricts status change). */
  isSelf: boolean;
  /** Called when the dialog is closed without saving. */
  onClose: () => void;
  /** Called after a successful save so the parent can refresh the list. */
  onSaved: () => void;
}

/**
 * Modal dialog for editing an existing user's details.
 *
 * - Pre-populates all editable fields from the provided `user` object.
 * - Password field is intentionally left blank; if left empty, the password is not updated.
 * - When `isSelf` is `true`, the Role select and Status select are disabled.
 * - Shows an inline `<Alert>` on API or validation errors; error codes are translated via the
 *   `errors` message namespace.
 * - On success, fires `onSaved` so the parent can refresh the list and shows a toast via
 *   `useMessageQueue`.
 *
 * @param props - Dialog configuration.
 * @returns A MUI Dialog that is open when `user` is non-null.
 */
export default function EditUserDialog({ user, isSelf, onClose, onSaved }: EditUserDialogProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const { addMessage } = useMessageQueue();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [status, setStatus] = useState<"PENDING" | "ACTIVE" | "SUSPENDED">("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = user !== null;

  // Reset form fields each time a different user is opened in the dialog
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(user.email);
      setUsername(user.username ?? "");
      setPassword("");
      setRole(user.role);
      setStatus(user.status);
      setError(null);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Submits the PATCH request with only the fields that changed. */
  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const body: Record<string, unknown> = {};

    if (trimmedEmail !== user.email) {
      body.email = trimmedEmail;
    }

    if (trimmedUsername !== (user.username ?? "")) {
      body.username = trimmedUsername;
    }

    if (!isSelf && role !== user.role) {
      body.role = role;
    }

    if (!isSelf && status !== user.status) {
      body.status = status;
    }

    if (password) {
      body.password = password;
    }

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (res.ok) {
      addMessage("information", t("updateSuccess"));
      onSaved();
      onClose();
    } else {
      const code = json?.error as string | undefined;
      const translated = code
        ? tErrors(code as Parameters<typeof tErrors>[0], { defaultMessage: code })
        : tCommon("error");
      setError(translated);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("editUser")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <TextField
            label={t("fields.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label={t("fields.username")}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
          />
          <TextField
            label={t("fields.password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            helperText={t("fields.passwordHint")}
          />
          <FormControl fullWidth>
            <InputLabel>{t("fields.role")}</InputLabel>
            <Select
              value={role}
              label={t("fields.role")}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
              disabled={isSelf}
            >
              <MenuItem value="USER">{t("role.USER")}</MenuItem>
              <MenuItem value="ADMIN">{t("role.ADMIN")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>{t("fields.status")}</InputLabel>
            <Select
              value={status}
              label={t("fields.status")}
              onChange={(e) => setStatus(e.target.value as "PENDING" | "ACTIVE" | "SUSPENDED")}
              disabled={isSelf}
            >
              <MenuItem value="PENDING">{t("status.PENDING")}</MenuItem>
              <MenuItem value="ACTIVE">{t("status.ACTIVE")}</MenuItem>
              <MenuItem value="SUSPENDED">{t("status.SUSPENDED")}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tCommon("cancel")}</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {t("updateUser")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
