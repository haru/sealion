/**
 * Shared icon component for external auth-provider buttons.
 * Maps {@link AuthProviderType} to a Material Icons glyph used in the login
 * page and the linked-IdP list on the profile page.
 */

import GitHubIcon from "@mui/icons-material/GitHub";
import GoogleIcon from "@mui/icons-material/Google";
import KeyIcon from "@mui/icons-material/Key";
import MicrosoftIcon from "@mui/icons-material/Microsoft";

import type { AuthProviderType } from "@/services/auth-provider/types";

/** Props for {@link ProviderIcon}. */
export interface ProviderIconProps {
  /** Provider kind. Drives the icon glyph. */
  type: AuthProviderType;
  /** Optional `fontSize` override; defaults to `"small"`. */
  fontSize?: "inherit" | "small" | "medium" | "large";
}

/**
 * Renders a Material Icons glyph corresponding to the IdP type.
 * Unknown types fall back to a neutral key glyph.
 *
 * @param props - The {@link ProviderIconProps}.
 * @returns The MUI icon element.
 */
export function ProviderIcon({ type, fontSize = "small" }: ProviderIconProps) {
  switch (type) {
    case "GOOGLE":
      return <GoogleIcon fontSize={fontSize} />;
    case "GITHUB":
      return <GitHubIcon fontSize={fontSize} />;
    case "MICROSOFT_ENTRA":
      return <MicrosoftIcon fontSize={fontSize} />;
    case "OIDC_GENERIC":
    default:
      return <KeyIcon fontSize={fontSize} />;
  }
}
