"use client";

import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/ui/AuthCard";
import { AuthFooterLink } from "@/components/ui/AuthFooterLink";

/** Maps error query parameter values to their i18n translation keys. */
const ERROR_KEY_MAP: Record<string, string> = {
  expired_token: "errorExpiredToken",
  invalid_token: "errorInvalidToken",
  missing_token: "errorMissingToken",
  suspended: "errorSuspended",
  not_found: "errorNotFound",
};

/**
 * Password reset result page — client component.
 *
 * Displays a success message or an error message based on the `status` or
 * `error` query parameter. Provides links back to login or to request a new
 * reset email.
 */
export default function ResetPasswordResultPage() {
  const t = useTranslations("resetPassword");
  const tAuth = useTranslations("auth");
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  const isError = !!error && !status;
  const isSuccess = status === "success";
  const errorKey = error ? ERROR_KEY_MAP[error] : undefined;

  return (
    <AuthCard>
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3, fontWeight: 700, textAlign: "center" }}>
        {isSuccess ? t("resultSuccessTitle") : t("confirmTitle")}
      </Typography>

      {isSuccess && (
        <>
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
            {t("resultSuccessMessage")}
          </Alert>
          <AuthFooterLink prompt="" href="/login" label={tAuth("login")} />
        </>
      )}

      {isError && errorKey && (
        <>
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {t(errorKey as Parameters<typeof t>[0])}
          </Alert>
          <AuthFooterLink prompt="" href="/reset-password" label={t("requestNewLink")} />
        </>
      )}

      {!isSuccess && !isError && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {t("generalError")}
        </Alert>
      )}
    </AuthCard>
  );
}
