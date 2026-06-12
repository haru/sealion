"use client";

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  TextField,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { formatProviderApiError, type ProviderApiErrorResponse } from "@/lib/sync/error-utils";
import { isValidBaseUrl } from "@/lib/validation/base-url";
import { getProviderMetadata } from "@/services/issue-provider/registry";

/** Returns a validation error message when baseUrl is enabled and malformed, or null when valid. */
function getBaseUrlError(enabled: boolean, touched: boolean, value: string, errorMsg: string): string | null {
  if (!enabled || !touched || !value) { return null; }
  return isValidBaseUrl(value) ? null : errorMsg;
}

/** Builds the PATCH request body for the provider update. */
function buildPatchBody(
  displayName: string,
  changeCredentials: boolean,
  credentials: Record<string, string>,
  isRequired: boolean,
  isOptional: boolean,
  useCustomBaseUrl: boolean,
  baseUrl: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = { displayName, changeCredentials };
  if (isRequired) {
    body.baseUrl = baseUrl;
  } else if (isOptional) {
    body.baseUrl = useCustomBaseUrl ? baseUrl : "";
  }
  if (changeCredentials) {
    body.credentials = credentials;
  }
  return body;
}

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
  const isOptional = metadata?.baseUrlMode === "optional";
  const isRequired = metadata?.baseUrlMode === "required";
  const showBaseUrlField = isRequired || isOptional;

  const [displayName, setDisplayName] = useState(provider.displayName);
  // For optional providers, checkbox is ON when provider.baseUrl is non-null
  const [useCustomBaseUrl, setUseCustomBaseUrl] = useState(isOptional ? Boolean(provider.baseUrl) : false);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [baseUrlTouched, setBaseUrlTouched] = useState(false);
  const [changeCredentials, setChangeCredentials] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrlEnabled = isRequired || (isOptional && useCustomBaseUrl);
  const baseUrlError = getBaseUrlError(baseUrlEnabled, baseUrlTouched, baseUrl, t("fields.invalidBaseUrl"));

  /** Updates a single credential field. */
  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  /** Toggles the custom base URL checkbox. */
  function handleToggleCustomBaseUrl(checked: boolean) {
    setUseCustomBaseUrl(checked);
    if (!checked) {
      setBaseUrl("");
      setBaseUrlTouched(false);
    }
  }

  /** Submits the provider update form. */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Block submission if baseUrl is enabled but invalid
    if (baseUrlEnabled && baseUrl && !isValidBaseUrl(baseUrl)) {
      setBaseUrlTouched(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body = buildPatchBody(displayName, changeCredentials, credentials, isRequired, isOptional, useCustomBaseUrl, baseUrl);

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
              label={tCommon("displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              fullWidth
            />

            {showBaseUrlField && isOptional && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={useCustomBaseUrl}
                    onChange={(e) => handleToggleCustomBaseUrl(e.target.checked)}
                  />
                }
                label={t("fields.useCustomBaseUrl")}
              />
            )}

            {showBaseUrlField && (
              <FormControl fullWidth error={Boolean(baseUrlError)}>
                <TextField
                  label={t("fields.baseUrl")}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  onBlur={() => setBaseUrlTouched(true)}
                  required={isRequired}
                  disabled={isOptional && !useCustomBaseUrl}
                  fullWidth
                  error={Boolean(baseUrlError)}
                />
                {baseUrlError && <FormHelperText>{baseUrlError}</FormHelperText>}
              </FormControl>
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
