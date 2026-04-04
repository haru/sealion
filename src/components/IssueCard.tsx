"use client";

import type { DraggableSyntheticListeners, DraggableAttributes } from "@dnd-kit/core";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { Box, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode, Ref } from "react";

import ProviderIcon from "@/components/ProviderIcon";

/** Props for {@link IssueCard}. */
interface IssueCardProps {
  /** Internal issue ID. */
  id: string;
  /** External ID from the provider (e.g. GitHub issue number). */
  externalId: string;
  /** Issue title. */
  title: string;
  /** ISO 8601 due date string, or `null`. */
  dueDate: string | null;
  /** URL to the issue on the external provider. */
  externalUrl: string;
  /** Whether the issue has no assignee. */
  isUnassigned: boolean;
  /** Provider icon URL or `null`. */
  providerIconUrl: string | null;
  /** Display name of the issue provider. */
  providerName: string;
  /** Display name of the project. */
  projectName: string;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerCreatedAt: string | null;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerUpdatedAt: string | null;
  /** Additional action button rendered beside the title (e.g. "Add to Today"). */
  actionButton: ReactNode;
  dragContainerRef?: Ref<HTMLDivElement>;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: DraggableSyntheticListeners;
  dragStyle?: CSSProperties;
  isDragging?: boolean;
  /** When true, the card is rendered as a semi-transparent ghost placeholder (opacity 0.15). */
  isGhost?: boolean;
  /** When true, renders an indigo left accent border and indigo card border to mark this as a today task. */
  isToday?: boolean;
  /** When true, the provider creation timestamp is rendered. Defaults to true. */
  showCreatedAt?: boolean;
  /** When true, the provider update timestamp is rendered. Defaults to false. */
  showUpdatedAt?: boolean;
  /**
   * Called when the user clicks the "Complete" button.
   * Only shown for open (non-closed) issues.
   * @param id - Internal issue ID.
   */
  onComplete?: (id: string) => void;
}

/** Displays a single issue as a styled card with metadata, drag handle, and action buttons. */
export default function IssueCard({
  id,
  externalId,
  title,
  dueDate,
  externalUrl,
  isUnassigned,
  providerIconUrl,
  providerName,
  projectName,
  providerCreatedAt,
  providerUpdatedAt,
  actionButton,
  dragContainerRef,
  dragHandleAttributes,
  dragHandleListeners,
  dragStyle,
  isDragging,
  isGhost,
  isToday = false,
  showCreatedAt = true,
  showUpdatedAt = false,
  onComplete,
}: IssueCardProps) {
  const t = useTranslations("todo");
  const tModal = useTranslations("completeModal");

  let cardOpacity: number;
  if (isGhost) {
    cardOpacity = 0.15;
  } else if (isDragging) {
    cardOpacity = 0.6;
  } else {
    cardOpacity = 1;
  }

  return (
    <Paper
      ref={dragContainerRef}
      style={dragStyle}
      elevation={0}
      sx={{
        p: "12px 16px 12px 10px",
        mb: 1.5,
        border: `1px solid ${isToday ? "#4f46e5" : "#e2e8f0"}`,
        borderRadius: "12px",
        bgcolor: "white",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        opacity: cardOpacity,
        transition: "border-color 0.2s, box-shadow 0.2s",
        "&:hover": {
          borderColor: isToday ? "#4f46e5" : "#cbd5e1",
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        },
      }}
    >
      {/* Left accent bar for today items */}
      {isToday && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: "primary.main",
            borderRadius: "12px 0 0 12px",
          }}
        />
      )}

      {/* Drag handle */}
      <Box
        {...dragHandleAttributes}
        {...dragHandleListeners}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mt: "2px",
          mr: 0.5,
          color: "#cbd5e1",
          cursor: "grab",
          flexShrink: 0,
          "&:active": { cursor: "grabbing" },
          "&:hover": { color: "text.secondary" },
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          {/* ID */}
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: "text.secondary",
              fontWeight: 500,
              fontSize: "0.85rem",
              mt: "2px",
              minWidth: 40,
              flexShrink: 0,
            }}
          >
            #{externalId}
          </Typography>

          {/* Title */}
          <Typography
            sx={{
              flex: 1,
              color: "text.primary",
              fontWeight: 600,
              fontSize: "1.0rem",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            {title}
          </Typography>

          {/* Action buttons */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
            {onComplete && (
              <Tooltip title={tModal("confirmButton")}>
                <IconButton
                  size="small"
                  onClick={() => onComplete(id)}
                  aria-label={tModal("confirmButton")}
                  sx={{
                    color: "text.secondary",
                    "&:hover": {
                      color: "primary.main",
                      bgcolor: "#eef2ff",
                    },
                  }}
                >
                  <TaskAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {actionButton}

            <Tooltip title={t("openInTracker")}>
              <IconButton
                size="small"
                component="a"
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "text.secondary" }}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Meta info row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            mt: 1.5,
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
            {/* Provider / project pill */}
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: "#f8fafc",
                border: "1px solid #f1f5f9",
                borderRadius: "100px",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
              }}
            >
              <ProviderIcon iconUrl={providerIconUrl} label={providerName} fontSize="small" />
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", fontWeight: 500 }}>
                {providerName} / {projectName}
              </Typography>
            </Box>

            {/* Due date — always shown, "Not set" when null */}
            <Box>
              <Typography sx={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 600, mb: 0.2, lineHeight: 1 }}>
                {t("dueDateLabel")}
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", fontWeight: 500 }}>
                {dueDate ? new Date(dueDate).toLocaleDateString() : t("notSet")}
              </Typography>
            </Box>

            {/* Created at stacked */}
            {showCreatedAt && (
              <Box>
                <Typography sx={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 600, mb: 0.2, lineHeight: 1 }}>
                  {t("createdAtLabel")}
                </Typography>
                <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", fontWeight: 500 }}>
                  {providerCreatedAt ? new Date(providerCreatedAt).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : t("notSet")}
                </Typography>
              </Box>
            )}

            {/* Unassigned badge */}
            {isUnassigned && (
              <Tooltip title={t("unassignedChipTooltip")}>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    bgcolor: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "100px",
                  }}
                >
                  <Typography sx={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 500 }}>
                    {t("unassignedChipLabel")}
                  </Typography>
                </Box>
              </Tooltip>
            )}
          </Box>

          {/* Updated at — italic, right-aligned */}
          {showUpdatedAt && providerUpdatedAt && (
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                fontStyle: "italic",
                flexShrink: 0,
              }}
            >
              {t("updatedAtLabel")}: {new Date(providerUpdatedAt).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
