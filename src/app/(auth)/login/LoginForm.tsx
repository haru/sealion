"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthCard } from "@/components/ui/AuthCard";
import { AuthFooterLink } from "@/components/ui/AuthFooterLink";
import type { AuthProviderType } from "@/services/auth-provider/types";

import { ExternalProviderButtons, type EnabledProvider } from "./_components/ExternalProviderButtons";

/** External error codes coming back from `signIn`-callback redirects. */
const KNOWN_EXTERNAL_ERRORS = new Set([
  "NO_EMAIL_FROM_PROVIDER",
  "EMAIL_NOT_VERIFIED",
  "SIGNUP_DISABLED",
]);

/** Maps a `?error=` code to the matching i18n key under `externalLogin.errors`. */
function externalErrorKey(error: string): string | null {
  switch (error) {
    case "NO_EMAIL_FROM_PROVIDER": return "errors.noEmail";
    case "EMAIL_NOT_VERIFIED": return "errors.emailNotVerified";
    case "SIGNUP_DISABLED": return "errors.signupDisabled";
    default: return null;
  }
}

/** Props for {@link LoginForm}. */
export interface LoginFormProps {
  /** When true, the "Sign Up" footer link is rendered. */
  showSignup: boolean;
  /** When true, the "Forgot password?" footer link is rendered. */
  showPasswordReset: boolean;
  /** Enabled external IdPs to render below the credentials form. */
  externalProviders?: EnabledProvider[];
  /** Optional external-flow error code from `?error=` query. */
  externalError?: string | null;
}

/** Login form with email/password credentials and optional external IdP buttons. */
export function LoginForm({
  showSignup,
  showPasswordReset,
  externalProviders = [],
  externalError = null,
}: LoginFormProps) {
  const t = useTranslations("auth");
  const tReset = useTranslations("resetPassword");
  const tExternal = useTranslations("externalLogin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verified = searchParams.get("verified") === "true";
  const verificationSent = searchParams.get("verification_sent") === "true";

  const externalErrorCode =
    externalError && KNOWN_EXTERNAL_ERRORS.has(externalError) ? externalError : null;
  const externalKey = externalErrorCode ? externalErrorKey(externalErrorCode) : null;

  /** Submits credentials to Auth.js and redirects on success. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "EMAIL_NOT_VERIFIED") {
        setError("emailNotVerified");
      } else {
        setError("invalidCredentials");
      }
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <AuthCard>
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3, fontWeight: 700, textAlign: "center" }}>
        {t("loginTitle")}
      </Typography>

      {verified && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          {t("emailVerified")}
        </Alert>
      )}

      {verificationSent && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          {t("verificationSent")}
        </Alert>
      )}

      {externalKey && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {tExternal(externalKey)}
        </Alert>
      )}

      {error === "emailNotVerified" && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {t("emailNotVerified")}
        </Alert>
      )}

      {error === "invalidCredentials" && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {t("invalidCredentials")}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <TextField
          label={t("email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          autoComplete="email"
          variant="outlined"
        />
        <TextField
          label={t("password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          autoComplete="current-password"
          variant="outlined"
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={loading}
          sx={{
            mt: 1,
            py: 1.5,
            borderRadius: 2,
            fontWeight: "bold",
            textTransform: "none",
            fontSize: "1rem",
          }}
        >
          {t("login")}
        </Button>
      </Box>

      <ExternalProviderButtons providers={externalProviders} callbackUrl={callbackUrl} />

      {showSignup && <AuthFooterLink prompt={t("noAccount")} href="/signup" label={t("signup")} />}
      {showPasswordReset && <AuthFooterLink prompt="" href="/reset-password" label={tReset("forgotPassword")} />}
    </AuthCard>
  );
}

// Re-export the AuthProviderType for callers that build the EnabledProvider[].
export type { AuthProviderType };
