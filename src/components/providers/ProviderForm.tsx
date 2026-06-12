"use client";

import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isValidBaseUrl } from "@/lib/validation/base-url";
import { getAllProviders } from "@/services/issue-provider/registry";

/** Returns a validation error message when baseUrl is enabled and malformed, or null when valid. */
function getBaseUrlError(enabled: boolean, touched: boolean, value: string, errorMsg: string): string | null {
  if (!enabled || !touched || !value) { return null; }
  return isValidBaseUrl(value) ? null : errorMsg;
}

/** Removes the `baseUrl` key from a credentials object immutably. */
function withoutBaseUrl(creds: Record<string, string>): Record<string, string> {
  const { baseUrl: _removed, ...rest } = creds;
  return rest;
}

/** Data shape submitted by {@link ProviderForm}. */
export interface ProviderFormData {
  type: string;
  displayName: string;
  credentials: Record<string, string>;
}

interface ProviderFormProps {
  onSubmit: (data: ProviderFormData) => Promise<void>;
}

/** Form for creating a new issue provider, with provider-type selection and credential fields. */
export default function ProviderForm({ onSubmit }: ProviderFormProps) {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");

  const providers = getAllProviders();
  const firstType = providers[0]?.type ?? "";

  const [type, setType] = useState<string>(firstType);
  const [displayName, setDisplayName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [useCustomBaseUrl, setUseCustomBaseUrl] = useState(false);
  const [baseUrlTouched, setBaseUrlTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMeta = providers.find((p) => p.type === type);
  const isOptional = selectedMeta?.baseUrlMode === "optional";
  const isRequired = selectedMeta?.baseUrlMode === "required";
  const showBaseUrlField = isRequired || isOptional;
  const baseUrlEnabled = isRequired || (isOptional && useCustomBaseUrl);
  const baseUrlValue = credentials.baseUrl ?? "";
  const baseUrlError = getBaseUrlError(baseUrlEnabled, baseUrlTouched, baseUrlValue, t("fields.invalidBaseUrl"));

  /** Updates a single credential field. */
  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  /** Resets credentials when the provider type changes. */
  function handleTypeChange(newType: string) {
    setType(newType);
    setCredentials({});
    setUseCustomBaseUrl(false);
    setBaseUrlTouched(false);
    setError(null);
  }

  /** Toggles the custom base URL checkbox. */
  function handleToggleCustomBaseUrl(checked: boolean) {
    setUseCustomBaseUrl(checked);
    if (!checked) {
      setCredentials((prev) => withoutBaseUrl(prev));
      setBaseUrlTouched(false);
    }
  }

  /** Submits the new provider form. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Block submission if baseUrl is enabled but invalid
    if (baseUrlEnabled && baseUrlValue && !isValidBaseUrl(baseUrlValue)) {
      setBaseUrlTouched(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({ type, displayName, credentials });
      setDisplayName("");
      setCredentials({});
      setUseCustomBaseUrl(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {/* Honeypot fields to prevent browser from autofilling real fields */}
      <input type="text" name="username" style={{ display: "none" }} autoComplete="username" readOnly />
      <input type="password" name="password" style={{ display: "none" }} autoComplete="current-password" readOnly />
      <Stack spacing={2} sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error">
            <Box component="span" sx={{ display: "block", whiteSpace: "pre-line" }}>{error}</Box>
          </Alert>
        )}

        <FormControl fullWidth required>
          <InputLabel>{t("fields.type")}</InputLabel>
          <Select
            value={type}
            label={t("fields.type")}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            {providers.map((meta) => (
              <MenuItem key={meta.type} value={meta.type}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {meta.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meta.iconUrl}
                      alt=""
                      aria-hidden="true"
                      style={{ width: 20, height: 20, objectFit: "contain" }}
                    />
                  )}
                  {meta.displayName}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label={tCommon("displayName")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          fullWidth
          name="providerName"
          autoComplete="organization"
          slotProps={{ htmlInput: { "data-testid": "provider-name-input" } }}
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
              placeholder={isOptional ? "https://github.example.com" : "https://your-domain.example.com"}
              value={baseUrlValue}
              onChange={(e) => handleCredentialChange("baseUrl", e.target.value)}
              onBlur={() => setBaseUrlTouched(true)}
              required={isRequired}
              disabled={isOptional && !useCustomBaseUrl}
              fullWidth
              error={Boolean(baseUrlError)}
            />
            {baseUrlError && <FormHelperText>{baseUrlError}</FormHelperText>}
          </FormControl>
        )}

        {selectedMeta?.credentialFields.map((field) => (
          <TextField
            key={field.key}
            label={t(`fields.${field.labelKey}`)}
            type={field.inputType}
            value={credentials[field.key] ?? ""}
            onChange={(e) => handleCredentialChange(field.key, e.target.value)}
            required={field.required}
            fullWidth
            slotProps={{ htmlInput: { "data-testid": `${field.key}-input` } }}
          />
        ))}

        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? tCommon("loading") : t("addProvider")}
        </Button>
      </Stack>
    </Box>
  );
}
