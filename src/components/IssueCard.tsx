"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
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
  /** When true, the provider creation timestamp chip is rendered. Defaults to true. */
  showCreatedAt?: boolean;
  /** When true, the provider update timestamp chip is rendered. Defaults to false. */
  showUpdatedAt?: boolean;
  /**
   * Called when the user clicks the "Complete" button.
   * Only shown for open (non-closed) issues.
   * @param id - Internal issue ID.
   */
  onComplete?: (id: string) => void;
}

/** Displays a single issue as a card with a Complete button, drag handle, and external link. */
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
  showCreatedAt = true,
  showUpdatedAt = false,
  onComplete,
}: IssueCardProps) {
  const t = useTranslations("todo");
  const tModal = useTranslations("completeModal");

  const dueDateFormatted = dueDate
    ? t("dueDate", { date: new Date(dueDate).toLocaleDateString() })
    : null;
  const createdFormatted = t("providerCreatedAt", {
    date: providerCreatedAt ? new Date(providerCreatedAt).toLocaleString() : "\u2014",
  });
  const updatedFormatted = t("providerUpdatedAt", {
    date: providerUpdatedAt ? new Date(providerUpdatedAt).toLocaleString() : "\u2014",
  });

  return (
    <Card
      ref={dragContainerRef}
      style={dragStyle}
      variant="outlined"
      sx={{ opacity: isGhost ? 0.15 : isDragging ? 0.6 : 1, mb: 1 }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box
            {...dragHandleAttributes}
            {...dragHandleListeners}
            sx={{
              cursor: "grab",
              color: "text.disabled",
              display: "flex",
              alignItems: "center",
              mt: 0.25,
              flexShrink: 0,
              "&:hover": { color: "text.secondary" },
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16 }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mb: 0.75 }}>
              <Typography
                variant="body2"
                component="span"
                sx={{
                  color: "text.disabled",
                  fontWeight: 500,
                  fontSize: "0.75rem",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                #{externalId}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  wordBreak: "break-word",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  color: "text.primary",
                  lineHeight: 1.4,
                }}
              >
                {title}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
              <Chip
                icon={<ProviderIcon iconUrl={providerIconUrl} label={providerName} fontSize="small" />}
                label={`${providerName} / ${projectName}`}
                size="small"
                variant="outlined"
              />
              {dueDateFormatted && (
                <Chip label={dueDateFormatted} size="small" variant="outlined" />
              )}
              {showCreatedAt && (
                <Chip label={createdFormatted} size="small" variant="outlined" />
              )}
              {showUpdatedAt && (
                <Chip label={updatedFormatted} size="small" variant="outlined" />
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

          {onComplete && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onComplete(id)}
              sx={{ mt: 0.25, flexShrink: 0 }}
            >
              {tModal("confirmButton")}
            </Button>
          )}

          {actionButton}

          <Tooltip title={t("openInTracker")}>
            <IconButton
              size="small"
              component="a"
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 0.25, flexShrink: 0 }}
            >
              <OpenInNewIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}
