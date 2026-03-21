"use client";

import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TodayIcon from "@mui/icons-material/Today";
import { useDraggable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import ProviderIcon from "@/components/ProviderIcon";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status = "OPEN" | "CLOSED";

interface TodoItemProps {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  providerIconUrl: string | null;
  providerName: string;
  projectName: string;
  onStatusChange?: (id: string, newStatus: Status) => void;
  onAddToToday?: (id: string) => void;
}

const PRIORITY_COLORS: Record<Priority, "default" | "primary" | "warning" | "error"> = {
  LOW: "default",
  MEDIUM: "primary",
  HIGH: "warning",
  CRITICAL: "error",
};

export default function TodoItem({
  id,
  title,
  status,
  priority,
  dueDate,
  externalUrl,
  isUnassigned,
  providerIconUrl,
  providerName,
  projectName,
  onStatusChange,
  onAddToToday,
}: TodoItemProps) {
  const t = useTranslations("todo");
  const tToday = useTranslations("todayTasks");

  const isComplete = status === "CLOSED";
  const dueDateFormatted = dueDate
    ? t("dueDate", { date: new Date(dueDate).toLocaleDateString() })
    : null;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: "todo-item", issueId: id },
  });

  function handleCheck() {
    onStatusChange?.(id, isComplete ? "OPEN" : "CLOSED");
  }

  return (
    <Card
      ref={setNodeRef}
      variant="outlined"
      sx={{
        opacity: isComplete || isDragging ? 0.6 : 1,
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

          <Box
            {...attributes}
            {...listeners}
            sx={{ flex: 1, minWidth: 0, cursor: "grab" }}
          >
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
                icon={
                  <ProviderIcon iconUrl={providerIconUrl} label={providerName} fontSize="small" />
                }
                label={`${providerName} / ${projectName}`}
                size="small"
                variant="outlined"
              />

              {dueDateFormatted && (
                <Chip label={dueDateFormatted} size="small" variant="outlined" />
              )}

              {isUnassigned && (
                <Tooltip title={t("unassignedChipTooltip")}>
                  <Chip
                    label={t("unassignedChipLabel")}
                    size="small"
                    variant="outlined"
                    color="warning"
                  />
                </Tooltip>
              )}
            </Stack>
          </Box>

          {onAddToToday && !isComplete && (
            <Tooltip title={tToday("addToToday")}>
              <IconButton
                size="small"
                onClick={() => onAddToToday(id)}
                aria-label={tToday("addToToday")}
              >
                <TodayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

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
