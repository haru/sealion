import Image from "next/image";
import CloudIcon from "@mui/icons-material/Cloud";

interface ProviderIconProps {
  iconUrl: string | null;
  label?: string;
  fontSize?: "small" | "medium" | "large" | "inherit";
}

const FONT_SIZE_PX: Record<"small" | "medium" | "large", number> = {
  small: 20,
  medium: 24,
  large: 35,
};

/** Renders a provider icon image, or a fallback cloud icon when no URL is available. */
export default function ProviderIcon({ iconUrl, label = "provider", fontSize = "medium" }: ProviderIconProps) {
  if (iconUrl) {
    if (fontSize === "inherit") {
      return (
        <Image
          src={iconUrl}
          alt={label}
          width={24}
          height={24}
          style={{ objectFit: "contain", width: "1em", height: "1em" }}
        />
      );
    }
    const size = FONT_SIZE_PX[fontSize];
    return (
      <Image
        src={iconUrl}
        alt={label}
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
      />
    );
  }
  return <CloudIcon fontSize={fontSize} />;
}
