"use client";

/**
 * Renders one button per enabled IdP on the login page. Collocated here because
 * only the login route consumes it (Principle VII).
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import { ProviderIcon } from "@/components/auth/ProviderIcon";
import type { AuthProviderType } from "@/services/auth-provider/types";

/** Minimal provider shape returned by `GET /api/auth-providers/enabled`. */
export interface EnabledProvider {
  providerId: string;
  type: AuthProviderType;
  displayName: string;
}

/** Props for {@link ExternalProviderButtons}. */
export interface ExternalProviderButtonsProps {
  /** The enabled providers to render. Empty array renders nothing. */
  providers: EnabledProvider[];
  /** Callback URL after a successful sign-in. Defaults to `"/"`. */
  callbackUrl?: string;
}

/**
 * Renders an MUI button per enabled IdP under a "or continue with" divider.
 * Returns `null` when the list is empty (so the login page shows only the
 * local credentials form).
 *
 * @param props - {@link ExternalProviderButtonsProps}.
 * @returns The button group, or `null` if no providers are enabled.
 */
export function ExternalProviderButtons({
  providers,
  callbackUrl = "/",
}: ExternalProviderButtonsProps) {
  const t = useTranslations("externalLogin");

  if (providers.length === 0) { return null; }

  return (
    <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Divider sx={{ my: 1, fontSize: "0.75rem", color: "text.secondary" }}>
        {t("orContinueWith")}
      </Divider>
      {providers.map((p) => (
        <Button
          key={p.providerId}
          onClick={() => { void signIn(p.providerId, { callbackUrl }); }}
          variant="outlined"
          size="large"
          fullWidth
          startIcon={<ProviderIcon type={p.type} />}
          sx={{
            py: 1.25,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 500,
            justifyContent: "center",
          }}
        >
          {t("signInWith", { provider: p.displayName })}
        </Button>
      ))}
    </Box>
  );
}
