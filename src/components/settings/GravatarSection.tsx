"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

/** Props for the {@link GravatarSection} component. */
export interface GravatarSectionProps {
  /** Current Gravatar preference value. */
  useGravatar: boolean;
  /** Whether the parent form is loading or submitting (disables the toggle). */
  disabled: boolean;
  /** Called when the user toggles the Gravatar switch. */
  onChange: (value: boolean) => void;
}

/**
 * Stateless sub-section for toggling Gravatar as the user's avatar.
 *
 * All state and submission are owned by the parent form.
 */
export default function GravatarSection({ useGravatar, disabled, onChange }: GravatarSectionProps) {
  const t = useTranslations("profileSettings");

  return (
    <>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        {t("gravatar.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("gravatar.description")}
      </Typography>

      <FormControlLabel
        control={
          <Switch
            data-testid="profile-gravatar-toggle"
            checked={useGravatar}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
        }
        label={t("gravatar.toggle")}
      />
    </>
  );
}
