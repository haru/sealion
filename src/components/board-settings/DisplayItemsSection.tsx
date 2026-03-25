"use client";

import { Checkbox, FormControlLabel, Stack } from "@mui/material";
import { useTranslations } from "next-intl";

interface DisplayItemsSectionProps {
  /** Whether the "Created At" timestamp is enabled. */
  showCreatedAt: boolean;
  /** Whether the "Updated At" timestamp is enabled. */
  showUpdatedAt: boolean;
  /**
   * Callback invoked when the user toggles a checkbox.
   * @param patch - Partial settings object with the changed field.
   */
  onChange: (patch: { showCreatedAt?: boolean; showUpdatedAt?: boolean }) => void;
}

/**
 * Renders checkboxes for toggling display of creation and update timestamps on issue cards.
 *
 * @param props - {@link DisplayItemsSectionProps}
 */
export default function DisplayItemsSection({
  showCreatedAt,
  showUpdatedAt,
  onChange,
}: DisplayItemsSectionProps) {
  const t = useTranslations("boardSettings.displayItems");

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Checkbox
            checked={showCreatedAt}
            onChange={(e) => onChange({ showCreatedAt: e.target.checked })}
          />
        }
        label={t("showCreatedAt")}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={showUpdatedAt}
            onChange={(e) => onChange({ showUpdatedAt: e.target.checked })}
          />
        }
        label={t("showUpdatedAt")}
      />
    </Stack>
  );
}
