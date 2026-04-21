"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

/** Props for the {@link GravatarSection} component. */
export interface GravatarSectionProps {
  /** Current Gravatar preference value from the server. */
  initialUseGravatar: boolean;
  /** Whether the profile data is still loading (disables form controls). */
  isLoading: boolean;
}

/**
 * Profile settings section for toggling Gravatar as the user's avatar.
 *
 * Renders a Switch bound to the Gravatar preference and a Save button that
 * PATCHes `/api/account/profile` with `{ useGravatar }`.
 */
export default function GravatarSection({ initialUseGravatar, isLoading }: GravatarSectionProps) {
  const t = useTranslations("profileSettings");
  const router = useRouter();
  const { update } = useSession();

  const [useGravatar, setUseGravatar] = useState(initialUseGravatar);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync internal state when the loaded value arrives from the parent
  useEffect(() => {
    setUseGravatar(initialUseGravatar);
  }, [initialUseGravatar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useGravatar }),
      });
      const json = (await response.json()) as { data: null; error: string | null };
      if (!response.ok || json.error) {
        setError(t("gravatar.saveError"));
      } else {
        setSuccess(t("gravatar.saveSuccess"));
        // Update JWT session immediately so layouts reflect the new preference without a sign-out cycle
        await update({ useGravatar });
        router.refresh();
      }
    } catch {
      setError(t("gravatar.saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        {t("gravatar.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("gravatar.description")}
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {success && (
          <Alert severity="success" data-testid="profile-gravatar-success-message">
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" data-testid="profile-gravatar-error-message">
            {error}
          </Alert>
        )}

        <FormControlLabel
          control={
            <Switch
              data-testid="profile-gravatar-toggle"
              checked={useGravatar}
              onChange={(e) => setUseGravatar(e.target.checked)}
              disabled={isLoading || isSubmitting}
            />
          }
          label={t("gravatar.toggle")}
        />

        <Button
          data-testid="profile-gravatar-save-button"
          type="submit"
          variant="contained"
          disabled={isSubmitting || isLoading}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("saveChanges")}
        </Button>
      </Box>
    </>
  );
}
