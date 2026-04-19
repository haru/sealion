"use client";

import { Box, Divider, Pagination, Paper, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

import type { ClientIssue } from "@/types/issue";

import TodoItem from "./TodoItem";
import TodoListSkeleton from "./TodoListSkeleton";

/** Props for {@link TodoList}. */
interface TodoListProps {
  /** Issues to display on the current page. */
  items: ClientIssue[];
  /** Total number of issues (for pagination). */
  total: number;
  /** Current page (1-based). */
  page: number;
  /** Number of issues per page. */
  limit: number;
  /** When true, shows a loading skeleton. */
  loading?: boolean;
  /** Called when the user navigates to a different page. */
  onPageChange?: (page: number) => void;
  /** When true, the provider creation timestamp chip is rendered on each card. Defaults to false. */
  showCreatedAt?: boolean;
  /** When true, the provider update timestamp chip is rendered on each card. Defaults to false. */
  showUpdatedAt?: boolean;
  /**
   * Called when the user clicks the "Complete" button on an issue card.
   * @param id - Internal issue ID.
   */
  onComplete?: (id: string) => void;
  /** Called when the user adds an issue to today's task list. */
  onAddToToday?: (id: string) => void;
  /**
   * Called when the user toggles the pin state of an issue.
   * @param id - Internal issue ID.
   * @param pinned - The new pinned state to apply.
   */
  onTogglePin?: (id: string, pinned: boolean) => void;
}

/** Paginated issue list with loading skeleton, pin, complete, and add-to-today callbacks. */
export default function TodoList({
  items,
  total,
  page,
  limit,
  loading,
  showCreatedAt,
  showUpdatedAt,
  onPageChange,
  onComplete,
  onAddToToday,
  onTogglePin,
}: TodoListProps) {
  const t = useTranslations("todo");
  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return <TodoListSkeleton />;
  }

  if (items.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.secondary">{t("noIssues")}</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
          {t("goToSettings")}
        </Typography>
      </Box>
    );
  }

  const listItemSx = {
    mb: 0,
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    "&:hover": { borderColor: "transparent", boxShadow: "none" },
  };

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{ border: 1, borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}
      >
        {items.map((issue, index) => (
          <Box key={issue.id}>
            {index > 0 && <Divider />}
            <TodoItem
              id={issue.id}
              externalId={issue.externalId}
              title={issue.title}
              dueDate={issue.dueDate}
              externalUrl={issue.externalUrl}
              isUnassigned={issue.isUnassigned}
              providerCreatedAt={issue.providerCreatedAt}
              providerUpdatedAt={issue.providerUpdatedAt}
              providerIconUrl={issue.project.issueProvider.iconUrl}
              providerName={issue.project.issueProvider.displayName}
              projectName={issue.project.displayName}
              showCreatedAt={showCreatedAt}
              showUpdatedAt={showUpdatedAt}
              pinned={issue.pinned}
              onComplete={onComplete}
              onAddToToday={onAddToToday}
              onTogglePin={onTogglePin}
              paperSx={listItemSx}
            />
          </Box>
        ))}

      </Paper>

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => onPageChange?.(p)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
