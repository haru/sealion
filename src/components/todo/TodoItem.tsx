"use client";

import {
  Card,
  CardContent,
  Checkbox,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Stack,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GitHubIcon from "@mui/icons-material/GitHub";
import CloudIcon from "@mui/icons-material/Cloud";
import { useTranslations } from "next-intl";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status = "OPEN" | "CLOSED";

interface TodoItemProps {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  externalUrl: string;
  providerType: string;
  providerName: string;
  projectName: string;
  onStatusChange?: (id: string, newStatus: Status) => void;
}

const PRIORITY_COLORS: Record<Priority, "default" | "primary" | "warning" | "error"> = {
  LOW: "default",
  MEDIUM: "primary",
  HIGH: "warning",
  CRITICAL: "error",
};

function ProviderIcon({ type }: { type: string }) {
  if (type === "GITHUB") return <GitHubIcon fontSize="small" />;
  return <CloudIcon fontSize="small" />;
}

export default function TodoItem({
  id,
  title,
  status,
  priority,
  dueDate,
  externalUrl,
  providerType,
  providerName,
  projectName,
  onStatusChange,
}: TodoItemProps) {
  const t = useTranslations("todo");

  const isComplete = status === "CLOSED";
  const dueDateFormatted = dueDate
    ? t("dueDate", { date: new Date(dueDate).toLocaleDateString() })
    : null;

  function handleCheck() {
    onStatusChange?.(id, isComplete ? "OPEN" : "CLOSED");
  }

  return (
    <Card
      variant="outlined"
      sx={{
        opacity: isComplete ? 0.6 : 1,
        mb: 1,
      }}
    >
      <CardContent sx={{ pb: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Checkbox
            checked={isComplete}
            onChange={handleCheck}
            aria-label={isComplete ? t("markIncomplete") : t("markComplete")}
            sx={{ mt: -0.5 }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              sx={{
                textDecoration: isComplete ? "line-through" : "none",
                wordBreak: "break-word",
              }}
            >
              {title}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
              <Chip
                label={t(`priority.${priority}`)}
                size="small"
                color={PRIORITY_COLORS[priority]}
              />

              <Chip
                icon={<ProviderIcon type={providerType} />}
                label={`${providerName} / ${projectName}`}
                size="small"
                variant="outlined"
              />

              {dueDateFormatted && (
                <Chip label={dueDateFormatted} size="small" variant="outlined" />
              )}
            </Stack>
          </Box>

          <Tooltip title={t("openInTracker")}>
            <IconButton
              size="small"
              component="a"
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}
