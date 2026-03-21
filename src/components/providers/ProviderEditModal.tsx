"use client";

import { type FormEvent, useState } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import { useTranslations } from "next-intl";

type ProviderType = "GITHUB" | "JIRA" | "REDMINE";

interface Provider {
  id: string;
  type: ProviderType;
  displayName: string;
  baseUrl: string | null;
  iconUrl: string | null;
}

interface ProviderEditModalProps {
  provider: Provider;
  open: boolean;
  onClose: () => void;
  onUpdated: (updated: Provider) => void;
}

/** Modal dialog for editing an existing issue provider's display name, base URL, or credentials. */
export default function ProviderEditModal({
  provider,
  open,
  onClose,
  onUpdated,
}: ProviderEditModalProps) {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");

  const [displayName, setDisplayName] = useState(provider.displayName);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [changeCredentials, setChangeCredentials] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Updates a single credential field. */
  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  /** Submits the provider update form. */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { displayName, changeCredentials };
      if (provider.type === "JIRA" || provider.type === "REDMINE") {
        body.baseUrl = baseUrl;
      }
      if (changeCredentials) {
        body.credentials = credentials;
      }

      const res = await fetch(`/api/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? tCommon("error"));
      }

      onUpdated(json.data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("editProvider")}</DialogTitle>
      <DialogContent>
        <Box component="form" id="provider-edit-form" onSubmit={handleSubmit} sx={{ pt: 1 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label={t("fields.displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              fullWidth
            />

            {(provider.type === "JIRA" || provider.type === "REDMINE") && (
              <TextField
                label={t("fields.baseUrl")}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
                fullWidth
              />
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={changeCredentials}
                  onChange={(e) => {
                    setChangeCredentials(e.target.checked);
                    setCredentials({});
                  }}
                />
              }
              label={t("changeCredentials")}
            />

            {changeCredentials && provider.type === "GITHUB" && (
              <TextField
                label={t("fields.token")}
                type="password"
                value={credentials.token ?? ""}
                onChange={(e) => handleCredentialChange("token", e.target.value)}
                required
                fullWidth
              />
            )}

            {changeCredentials && provider.type === "JIRA" && (
              <>
                <TextField
                  label={t("fields.email")}
                  type="email"
                  value={credentials.email ?? ""}
                  onChange={(e) => handleCredentialChange("email", e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label={t("fields.apiToken")}
                  type="password"
                  value={credentials.apiToken ?? ""}
                  onChange={(e) => handleCredentialChange("apiToken", e.target.value)}
                  required
                  fullWidth
                />
              </>
            )}

            {changeCredentials && provider.type === "REDMINE" && (
              <TextField
                label={t("fields.apiKey")}
                type="password"
                value={credentials.apiKey ?? ""}
                onChange={(e) => handleCredentialChange("apiKey", e.target.value)}
                required
                fullWidth
              />
            )}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="submit"
          form="provider-edit-form"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? tCommon("loading") : t("updateProvider")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

