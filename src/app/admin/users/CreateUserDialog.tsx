"use client";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface CreateUserDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog requests to be closed. */
  onClose: () => void;
  /** Called after a user is successfully created. May return a Promise. */
  onCreated: () => void | Promise<void>;
}

/**
 * Dialog form for creating a new user account.
 *
 * @param props - {@link CreateUserDialogProps}
 * @returns A controlled dialog with email, username, password, and role fields.
 */
export default function CreateUserDialog({ open, onClose, onCreated }: CreateUserDialogProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Translates an API error code into a user-facing string.
   *
   * @param code - The error code string returned by the API, or undefined.
   * @returns A localised error message.
   */
  function translateError(code: string | undefined): string {
    if (!code) {
      return tCommon("error");
    }
    try {
      return tErrors(code as Parameters<typeof tErrors>[0]);
    } catch {
      return tCommon("error");
    }
  }

  /** Resets form fields and closes the dialog. */
  function handleClose() {
    setEmail("");
    setPassword("");
    setUsername("");
    setRole("USER");
    setFormError(null);
    onClose();
  }

  /** Submits the create-user form. */
  async function handleSubmit() {
    setCreating(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, username: username.trim() }),
      });

      const json = await res.json();
      if (res.ok) {
        handleClose();
        await Promise.resolve(onCreated());
      } else {
        setFormError(translateError(json?.error as string | undefined));
      }
    } catch {
      setFormError(tCommon("error"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("createUser")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError && (
            <Alert severity="error" onClose={() => setFormError(null)}>
              {formError}
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
            required
          />
          <TextField
            label={t("fields.password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
          />
          <FormControl fullWidth>
            <InputLabel>{t("fields.role")}</InputLabel>
            <Select
              value={role}
              label={t("fields.role")}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
            >
              <MenuItem value="USER">{t("role.USER")}</MenuItem>
              <MenuItem value="ADMIN">{t("role.ADMIN")}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{tCommon("cancel")}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={creating}>
          {t("createUser")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
