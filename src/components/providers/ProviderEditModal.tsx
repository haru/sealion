"use client";

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
import { type FormEvent, useState } from "react";

import { formatProviderApiError, type ProviderApiErrorResponse } from "@/lib/error-utils";
import { getProviderMetadata } from "@/services/issue-provider/registry";

interface Provider {
  id: string;
  type: string;
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
  const tSync = useTranslations("sync");

  const metadata = getProviderMetadata(provider.type);

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
      if (metadata?.baseUrlMode === "required") {
        body.baseUrl = baseUrl;
      } else if (metadata?.baseUrlMode === "optional" && baseUrl.trim() !== "") {
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

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new Error(tCommon("error"));
      }

      if (!res.ok) {
        throw new Error(formatProviderApiError(json as ProviderApiErrorResponse, tSync, tCommon("error")));
      }

      onUpdated((json as { data: Provider }).data);
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
            {error && (
              <Alert severity="error">
                <Box component="span" sx={{ display: "block", whiteSpace: "pre-line" }}>{error}</Box>
              </Alert>
            )}

            <TextField
              label={t("fields.displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              fullWidth
            />

            {metadata && metadata.baseUrlMode !== "none" && (
              <TextField
                label={t("fields.baseUrl")}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required={metadata.baseUrlMode === "required"}
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

            {changeCredentials && metadata?.credentialFields.map((field) => (
              <TextField
                key={field.key}
                label={t(`fields.${field.labelKey}`)}
                type={field.inputType}
                value={credentials[field.key] ?? ""}
                onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                required={field.required}
                fullWidth
              />
            ))}
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
