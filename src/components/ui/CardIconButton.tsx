import { IconButton } from "@mui/material";
import type { IconButtonProps } from "@mui/material";

/** IconButton with the standard card-action hover style (primary color + indigo tint). */
export default function CardIconButton({ sx, ...props }: IconButtonProps) {
  return (
    <IconButton
      size="small"
      sx={[
        {
          color: "text.secondary",
          "&:hover": {
            color: "primary.main",
            bgcolor: "#eef2ff",
          },
        },
        ...(Array.isArray(sx) ? sx : [sx ?? false]),
      ]}
      {...props}
    />
  );
}
