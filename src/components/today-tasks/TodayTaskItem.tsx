"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import ProviderIcon from "@/components/ProviderIcon";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface TodayTaskItemProps {
  id: string;
  title: string;
  priority: Priority;
  externalUrl: string;
  providerIconUrl: string | null;
  providerName: string;
  projectName: string;
  onRemove: (id: string) => void;
}

const PRIORITY_COLORS: Record<Priority, "default" | "primary" | "warning" | "error"> = {
  LOW: "default",
  MEDIUM: "primary",
  HIGH: "warning",
  CRITICAL: "error",
};

export default function TodayTaskItem({
  id,
  title,
  priority,
  providerIconUrl,
  providerName,
  projectName,
  onRemove,
}: TodayTaskItemProps) {
  const t = useTranslations("todayTasks");
  const tTodo = useTranslations("todo");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "today-item", issueId: id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ pb: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{ cursor: "grab", color: "text.secondary", display: "flex", alignItems: "center" }}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" sx={{ wordBreak: "break-word" }}>
              {title}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
              <Chip
                label={tTodo(`priority.${priority}`)}
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
            </Stack>
          </Box>

          <Tooltip title={t("remove")}>
            <IconButton
              size="small"
              onClick={() => onRemove(id)}
              aria-label={t("remove")}
            >
              <RemoveCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}
