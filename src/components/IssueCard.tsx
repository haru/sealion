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
      <CardContent sx={{ pb: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box
            {...dragHandleAttributes}
            {...dragHandleListeners}
            sx={{ cursor: "grab", color: "text.secondary", display: "flex", alignItems: "center", mt: 0.5 }}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              sx={{ wordBreak: "break-word" }}
            >
              {`#${externalId} ${title}`}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
              <Chip
                icon={<ProviderIcon iconUrl={providerIconUrl} label={providerName} fontSize="small" />}
                label={`${providerName} / ${projectName}`}
                size="small"
                variant="outlined"
              />
              {dueDateFormatted && (
                <Chip label={dueDateFormatted} size="small" variant="outlined" />
              )}
              <Chip label={createdFormatted} size="small" variant="outlined" />
              <Chip label={updatedFormatted} size="small" variant="outlined" />
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
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}
