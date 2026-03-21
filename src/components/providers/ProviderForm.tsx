"use client";

import { useState } from "react";
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

type ProviderType = "GITHUB" | "JIRA" | "REDMINE";

interface ProviderFormData {
  type: ProviderType;
  displayName: string;
  credentials: Record<string, string>;
}

interface ProviderFormProps {
  onSubmit: (data: ProviderFormData) => Promise<void>;
}

const PROVIDER_TYPES: ProviderType[] = ["GITHUB", "JIRA", "REDMINE"];

/** Form fields for GitHub provider credentials. */
function GitHubFields({
  credentials,
  onChange,
  t,
}: {
  credentials: Record<string, string>;
  onChange: (key: string, value: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <TextField
      label={t("fields.token")}
      type="password"
      value={credentials.token ?? ""}
      onChange={(e) => onChange("token", e.target.value)}
      required
      fullWidth
    />
  );
}

/** Form fields for Jira provider credentials. */
function JiraFields({
  credentials,
  onChange,
  t,
}: {
  credentials: Record<string, string>;
  onChange: (key: string, value: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <TextField
        label={t("fields.baseUrl")}
        placeholder="https://your-org.atlassian.net"
        value={credentials.baseUrl ?? ""}
        onChange={(e) => onChange("baseUrl", e.target.value)}
        required
        fullWidth
      />
      <TextField
        label={t("fields.email")}
        type="email"
        value={credentials.email ?? ""}
        onChange={(e) => onChange("email", e.target.value)}
        required
        fullWidth
      />
      <TextField
        label={t("fields.apiToken")}
        type="password"
        value={credentials.apiToken ?? ""}
        onChange={(e) => onChange("apiToken", e.target.value)}
        required
        fullWidth
      />
    </>
  );
}

/** Form fields for Redmine provider credentials. */
function RedmineFields({
  credentials,
  onChange,
  t,
}: {
  credentials: Record<string, string>;
  onChange: (key: string, value: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <TextField
        label={t("fields.baseUrl")}
        placeholder="https://redmine.example.com"
        value={credentials.baseUrl ?? ""}
        onChange={(e) => onChange("baseUrl", e.target.value)}
        required
        fullWidth
      />
      <TextField
        label={t("fields.apiKey")}
        type="password"
        value={credentials.apiKey ?? ""}
        onChange={(e) => onChange("apiKey", e.target.value)}
        required
        fullWidth
      />
    </>
  );
}

/** Form for creating a new issue provider, with provider-type selection and credential fields. */
export default function ProviderForm({ onSubmit }: ProviderFormProps) {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");

  const [type, setType] = useState<ProviderType>("GITHUB");
  const [displayName, setDisplayName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Updates a single credential field. */
  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  /** Resets credentials when the provider type changes. */
  function handleTypeChange(newType: ProviderType) {
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
        {error && <Alert severity="error">{error}</Alert>}

        <FormControl fullWidth required>
          <InputLabel>{t("fields.type")}</InputLabel>
          <Select
            value={type}
            label={t("fields.type")}
            onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
          >
            {PROVIDER_TYPES.map((pt) => (
              <MenuItem key={pt} value={pt}>
                {t(`type.${pt}`)}
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
        />

        {type === "GITHUB" && (
          <GitHubFields credentials={credentials} onChange={handleCredentialChange} t={t} />
        )}
        {type === "JIRA" && (
          <JiraFields credentials={credentials} onChange={handleCredentialChange} t={t} />
        )}
        {type === "REDMINE" && (
          <RedmineFields credentials={credentials} onChange={handleCredentialChange} t={t} />
        )}

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
