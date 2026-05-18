"use client";

/**
 * Admin form for creating or updating an `AuthProvider`. Collocated under the
 * admin route (Principle VII) since only this page consumes it.
 */

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { AuthProviderType } from "@/services/auth-provider/types";

/** Types supported by the form. */
export type SupportedAuthProviderType = Extract<
  AuthProviderType,
  "GOOGLE" | "OIDC_GENERIC" | "GITHUB" | "MICROSOFT_ENTRA"
>;

/** Initial values for edit mode. */
export interface AuthProviderInitialValues {
  /** Database UUID of the provider. */
  id: string;
  /** Unique provider identifier (e.g. "google", "my-oidc"). */
  providerId: string;
  /** Provider type. */
  type: SupportedAuthProviderType;
  /** Human-readable name shown on the login page. */
  displayName: string;
  /** Whether the provider is active. */
  enabled: boolean;
  /** Issuer URL for OIDC_GENERIC / MICROSOFT_ENTRA. */
  issuerUrl: string;
  /** OAuth client ID. */
  clientId: string;
  /** OAuth scope (empty string if not set). */
  scope: string;
}

/** Props for {@link AuthProviderForm}. */
export interface AuthProviderFormProps {
  /** Called after a successful POST returns 201. */
  onCreated?: () => void;
  /** Called after a successful PATCH returns 200. */
  onUpdated?: () => void;
  /** Called when the user clicks Cancel. */
  onCancel?: () => void;
  /** Optional list of types to offer; defaults to all supported types. */
  supportedTypes?: SupportedAuthProviderType[];
  /** When provided the form operates in edit mode and PATCHes to `[id]`. */
  initialValues?: AuthProviderInitialValues;
}

/**
 * Controlled MUI form that POSTs to `/api/admin/auth-providers` (create) or
 * PATCHes to `/api/admin/auth-providers/[id]` (update). Validates client-side
 * that `issuerUrl` is set for OIDC_GENERIC and MICROSOFT_ENTRA.
 *
 * @param props - {@link AuthProviderFormProps}.
 * @returns The form element.
 */
export function AuthProviderForm({
  onCreated,
  onUpdated,
  onCancel,
  supportedTypes = ["GOOGLE", "OIDC_GENERIC", "GITHUB", "MICROSOFT_ENTRA" as const],
  initialValues,
}: AuthProviderFormProps) {
  const t = useTranslations("authProviders.admin");
  const tCommon = useTranslations("common");
  const isEdit = initialValues !== undefined;

  const defaults = useMemo(() => ({
    type: supportedTypes[0],
    providerId: "",
    displayName: "",
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
    enabled: true,
    scope: "",
  }), [supportedTypes]);

  const src = isEdit
    ? {
        type: initialValues.type,
        providerId: initialValues.providerId,
        displayName: initialValues.displayName,
        issuerUrl: initialValues.issuerUrl,
        clientId: initialValues.clientId,
        clientSecret: "",
        enabled: initialValues.enabled,
        scope: initialValues.scope,
      }
    : defaults;

  const [type, setType] = useState<SupportedAuthProviderType>(src.type);
  const [providerId, setProviderId] = useState(src.providerId);
  const [displayName, setDisplayName] = useState(src.displayName);
  const [issuerUrl, setIssuerUrl] = useState(src.issuerUrl);
  const [clientId, setClientId] = useState(src.clientId);
  const [clientSecret, setClientSecret] = useState(src.clientSecret);
  const [enabled, setEnabled] = useState(src.enabled);
  const [scope, setScope] = useState(src.scope);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requiresIssuer = type === "OIDC_GENERIC" || type === "MICROSOFT_ENTRA";

  /** Submits the form (POST for create, PATCH for update). */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (requiresIssuer && !issuerUrl) {
      setError(t("form.errors.issuerRequired"));
      return;
    }
    setLoading(true);
    const url = isEdit
      ? `/api/admin/auth-providers/${initialValues.id}`
      : "/api/admin/auth-providers";
    const method = isEdit ? "PATCH" : "POST";
    const body = isEdit
      ? {
          displayName,
          enabled,
          issuerUrl: requiresIssuer ? issuerUrl : null,
          clientId,
          ...(clientSecret ? { clientSecret } : {}),
          scope: scope || null,
        }
      : {
          providerId,
          type,
          displayName,
          enabled,
          issuerUrl: requiresIssuer ? issuerUrl : null,
          clientId,
          clientSecret,
          scope: scope || null,
        };
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (isEdit && res.ok) {
        onUpdated?.();
        return;
      }
      if (!isEdit && res.status === 201) {
        setProviderId("");
        setDisplayName("");
        setIssuerUrl("");
        setClientId("");
        setClientSecret("");
        setScope("");
        onCreated?.();
        return;
      }
      const code = await extractErrorCode(res);
      setError(t(`form.errors.${code}`));
    } catch {
      setError(t("form.errors.UNKNOWN"));
    } finally {
      setLoading(false);
    }
  }

  const idleLabel = isEdit ? t("form.update") : tCommon("save");
  const submitLabel = loading ? t(isEdit ? "form.updating" : "form.saving") : idleLabel;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <FormControl fullWidth disabled={isEdit}>
        <InputLabel id="auth-provider-type-label">{t("form.type")}</InputLabel>
        <Select
          labelId="auth-provider-type-label"
          value={type}
          label={t("form.type")}
          onChange={(e) => setType(e.target.value as SupportedAuthProviderType)}
        >
          {supportedTypes.map((tt) => (
            <MenuItem key={tt} value={tt}>{t(`types.${tt}`)}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label={t("form.providerId")}
        helperText={t("form.providerIdHelp")}
        value={providerId}
        onChange={(e) => setProviderId(e.target.value)}
        required
        fullWidth
        disabled={isEdit}
      />

      <TextField
        label={tCommon("displayName")}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
        fullWidth
      />

      {requiresIssuer && (
        <TextField
          label={t("form.issuerUrl")}
          value={issuerUrl}
          onChange={(e) => setIssuerUrl(e.target.value)}
          required
          fullWidth
          type="url"
        />
      )}

      <TextField
        label={t("form.clientId")}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        required
        fullWidth
      />

      <TextField
        label={t("form.clientSecret")}
        helperText={isEdit ? t("form.clientSecretEditHelp") : undefined}
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
        required={!isEdit}
        fullWidth
        type="password"
      />

      <TextField
        label={t("form.scope")}
        helperText={t("form.scopeHelp")}
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        fullWidth
      />

      <FormControlLabel
        control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
        label={t("form.enabled")}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        {onCancel && (
          <Button type="button" onClick={onCancel} disabled={loading}>
            {tCommon("cancel")}
          </Button>
        )}
        <Button type="submit" variant="contained" disabled={loading}>
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
}

/**
 * Extracts an error code string from a fetch response.
 *
 * @param res - The fetch response to extract the code from.
 * @returns The error code string, or "UNKNOWN" if parsing fails.
 */
async function extractErrorCode(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") { return body.error; }
  } catch { /* keep UNKNOWN */ }
  return "UNKNOWN";
}
