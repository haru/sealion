/**
 * Shared icon component for external auth-provider buttons.
 * Maps {@link AuthProviderType} to a Material Icons glyph used in the login
 * page and the linked-IdP list on the profile page.
 */

import GitHubIcon from "@mui/icons-material/GitHub";
import KeyIcon from "@mui/icons-material/Key";
import Image from "next/image";

import type { AuthProviderType } from "@/services/auth-provider/types";

const fontSizePx: Record<"small" | "medium" | "large", number> = {
  small: 20,
  medium: 24,
  large: 36,
};

/** Props for {@link ProviderIcon}. */
export interface ProviderIconProps {
  /** Provider kind. Drives the icon glyph. */
  type: AuthProviderType;
  /** Optional `fontSize` override; defaults to `"small"`. */
  fontSize?: "inherit" | "small" | "medium" | "large";
}

/**
 * Renders an icon corresponding to the IdP type.
 * Google uses a PNG logo; others use Material Icons glyphs.
 * Unknown types fall back to a neutral key glyph.
 *
 * @param props - The {@link ProviderIconProps}.
 * @returns The icon element.
 */
export function ProviderIcon({ type, fontSize = "small" }: ProviderIconProps) {
  if (type === "GOOGLE") {
    const size = fontSize === "inherit" ? fontSizePx.small : (fontSizePx[fontSize] ?? fontSizePx.small);
    return (
      <Image
        src="/providers/google.png"
        alt="Google"
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    );
  }

  if (type === "MICROSOFT_ENTRA") {
    const size = fontSize === "inherit" ? fontSizePx.small : (fontSizePx[fontSize] ?? fontSizePx.small);
    return (
      <Image
        src="/providers/azure.svg"
        alt="Microsoft Entra ID"
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    );
  }

  switch (type) {
    case "GITHUB":
      return <GitHubIcon fontSize={fontSize} />;
    case "OIDC_GENERIC":
    default:
      return <KeyIcon fontSize={fontSize} />;
  }
}
