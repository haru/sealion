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
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useTranslations } from "next-intl";
import ProviderIcon from "@/components/ProviderIcon";
import type { DraggableSyntheticListeners, DraggableAttributes } from "@dnd-kit/core";
import type { CSSProperties, ReactNode, Ref } from "react";
import type { Priority, Status } from "@/lib/types";

const PRIORITY_COLORS: Record<Priority, "default" | "primary" | "warning" | "error"> = {
  LOW: "default",
  MEDIUM: "primary",
  HIGH: "warning",
  CRITICAL: "error",
};

interface IssueCardProps {
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
  actionButton: ReactNode;
  dragContainerRef?: Ref<HTMLDivElement>;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: DraggableSyntheticListeners;
  dragStyle?: CSSProperties;
  isDragging?: boolean;
  onStatusChange?: (id: string, newStatus: Status) => void;
}

export default function IssueCard({
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
  actionButton,
  dragContainerRef,
  dragHandleAttributes,
  dragHandleListeners,
  dragStyle,
  isDragging,
  onStatusChange,
}: IssueCardProps) {
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
      ref={dragContainerRef}
      style={dragStyle}
      variant="outlined"
      sx={{ opacity: isComplete || isDragging ? 0.6 : 1, mb: 1 }}
    >
      <CardContent sx={{ pb: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box
            {...dragHandleAttributes}
            {...dragHandleListeners}
            sx={{ cursor: "grab", color: "text.secondary", display: "flex", alignItems: "center", mt: 0.5 }}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>

          <Checkbox
            checked={isComplete}
            onChange={handleCheck}
            aria-label={isComplete ? t("markIncomplete") : t("markComplete")}
            sx={{ mt: -0.5 }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              sx={{ textDecoration: isComplete ? "line-through" : "none", wordBreak: "break-word" }}
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
                icon={<ProviderIcon iconUrl={providerIconUrl} label={providerName} fontSize="small" />}
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

          {actionButton}

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
