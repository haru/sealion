"use client";

import { Box, Pagination, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import TodoItem from "./TodoItem";
import TodoListSkeleton from "./TodoListSkeleton";

interface Issue {
  id: string;
  externalId: string;
  title: string;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
  project: {
    displayName: string;
    issueProvider: { iconUrl: string | null; displayName: string };
  };
}

/** Props for {@link TodoList}. */
interface TodoListProps {
  /** Issues to display on the current page. */
  items: Issue[];
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
  /**
   * Called when the user clicks the "Complete" button on an issue card.
   * @param id - Internal issue ID.
   */
  onComplete?: (id: string) => void;
  /** Called when the user adds an issue to today's task list. */
  onAddToToday?: (id: string) => void;
}

/** Paginated issue list with loading skeleton, complete button, and add-to-today callbacks. */
export default function TodoList({
  items,
  total,
  page,
  limit,
  loading,
  onPageChange,
  onComplete,
  onAddToToday,
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

  return (
    <Box>
      {items.map((issue) => (
        <TodoItem
          key={issue.id}
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
          onComplete={onComplete}
          onAddToToday={onAddToToday}
        />
      ))}

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
