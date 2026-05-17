"use client";

/**
 * Admin form for creating an `AuthProvider`. Collocated under the admin route
 * (Principle VII) since only this page consumes it. US1 supports GOOGLE and
 * OIDC_GENERIC; GITHUB and MICROSOFT_ENTRA are added in US2 (T044).
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
import { useState } from "react";

import type { AuthProviderType } from "@/services/auth-provider/types";

/** Types supported by the form in US1. US2 (T044) extends this list. */
export type SupportedAuthProviderType = Extract<
  AuthProviderType,
  "GOOGLE" | "OIDC_GENERIC" | "GITHUB" | "MICROSOFT_ENTRA"
>;

/** Props for {@link AuthProviderForm}. */
export interface AuthProviderFormProps {
  /** Called after a successful POST returns 201. */
  onCreated?: () => void;
  /** Optional list of types to offer; defaults to GOOGLE + OIDC_GENERIC for US1. */
  supportedTypes?: SupportedAuthProviderType[];
}

/**
 * Controlled MUI form that POSTs to `/api/admin/auth-providers`. Validates
 * client-side that `issuerUrl` is set for OIDC_GENERIC and MICROSOFT_ENTRA.
 *
 * @param props - {@link AuthProviderFormProps}.
 * @returns The form element.
 */
export function AuthProviderForm({
  onCreated,
  supportedTypes = ["GOOGLE", "OIDC_GENERIC", "GITHUB", "MICROSOFT_ENTRA" as const],
}: AuthProviderFormProps) {
  const t = useTranslations("authProviders.admin");
  const [type, setType] = useState<SupportedAuthProviderType>(supportedTypes[0]);
  const [providerId, setProviderId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [scope, setScope] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requiresIssuer = type === "OIDC_GENERIC" || type === "MICROSOFT_ENTRA";

  /** POSTs the form. On 201 calls `onCreated`; on 4xx surfaces a translated error. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (requiresIssuer && !issuerUrl) {
      setError(t("form.errors.issuerRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          type,
          displayName,
          enabled,
          issuerUrl: requiresIssuer ? issuerUrl : null,
          clientId,
          clientSecret,
          scope: scope || null,
        }),
      });
      if (res.status === 201) {
        setProviderId("");
        setDisplayName("");
        setIssuerUrl("");
        setClientId("");
        setClientSecret("");
        setScope("");
        onCreated?.();
        return;
      }
      let code = "UNKNOWN";
      try {
        const body = await res.json();
        if (typeof body?.error === "string") { code = body.error; }
      } catch { /* keep UNKNOWN */ }
      setError(t(`form.errors.${code}`));
    } catch {
      setError(t("form.errors.UNKNOWN"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <FormControl fullWidth>
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
      />

      <TextField
        label={t("form.displayName")}
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
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
        required
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

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? t("form.saving") : t("form.save")}
        </Button>
      </Box>
    </Box>
  );
}
