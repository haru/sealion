"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { AuthCard } from "@/components/ui/AuthCard";

/** Maps error query parameter values to their i18n translation keys. */
const ERROR_KEY_MAP: Record<string, string> = {
  missing_token: "errorMissingToken",
  expired_token: "errorExpiredToken",
  invalid_token: "errorInvalidToken",
};

/**
 * Displays the result of an email verification attempt.
 * Shows an error message when redirected here with an `error` query parameter.
 */
export default function ConfirmPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorKey = error ? ERROR_KEY_MAP[error] : undefined;

  return (
    <AuthCard>
      <Typography variant="h5" component="h2" fontWeight="700" textAlign="center" gutterBottom sx={{ mb: 3 }}>
        {t("confirmTitle")}
      </Typography>

      {errorKey ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {t(errorKey as Parameters<typeof t>[0])}
        </Alert>
      ) : (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {t("checkEmail")}
        </Alert>
      )}
    </AuthCard>
  );
}
