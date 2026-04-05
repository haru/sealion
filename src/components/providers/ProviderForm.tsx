"use client";

import {
  Box,
  Button,
  FormControl,
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

import { getAllProviders } from "@/services/issue-provider/registry";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMeta = providers.find((p) => p.type === type);

  /** Updates a single credential field. */
  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  /** Resets credentials when the provider type changes. */
  function handleTypeChange(newType: string) {
    setType(newType);
    setCredentials({});
    setError(null);
  }

  /** Submits the new provider form. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({ type, displayName, credentials });
      setDisplayName("");
      setCredentials({});
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
      <Stack spacing={2}>
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
                {meta.displayName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label={t("fields.displayName")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          fullWidth
          name="providerName"
          autoComplete="organization"
          inputProps={{ "data-testid": "provider-name-input" }}
        />

        {selectedMeta && selectedMeta.baseUrlMode !== "none" && (
          <TextField
            label={t("fields.baseUrl")}
            placeholder={selectedMeta.baseUrlMode === "optional" ? "https://gitlab.com" : "https://your-domain.example.com"}
            value={credentials.baseUrl ?? ""}
            onChange={(e) => handleCredentialChange("baseUrl", e.target.value)}
            required={selectedMeta.baseUrlMode === "required"}
            fullWidth
          />
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
            inputProps={{ "data-testid": `${field.key}-input` }}
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
