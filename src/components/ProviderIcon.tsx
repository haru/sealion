import Image from "next/image";
import CloudIcon from "@mui/icons-material/Cloud";

interface ProviderIconProps {
  iconUrl: string | null;
  label?: string;
  fontSize?: "small" | "medium" | "large" | "inherit";
}

export default function ProviderIcon({ iconUrl, label = "provider", fontSize = "medium" }: ProviderIconProps) {
  if (iconUrl) {
    const size = fontSize === "small" ? 20 : 24;
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
