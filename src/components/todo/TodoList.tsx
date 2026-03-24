"use client";

import { Box, Pagination, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import TodoItem from "./TodoItem";
import TodoListSkeleton from "./TodoListSkeleton";
import type { Status } from "@/lib/types";

interface Issue {
  id: string;
  externalId: string;
  title: string;
  status: Status;
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

interface TodoListProps {
  items: Issue[];
  total: number;
  page: number;
  limit: number;
  loading?: boolean;
  onPageChange?: (page: number) => void;
  onStatusChange?: (id: string, newStatus: Status) => void;
  onAddToToday?: (id: string) => void;
}

/** Paginated issue list with loading skeleton and status-change callbacks. */
export default function TodoList({
  items,
  total,
  page,
  limit,
  loading,
  onPageChange,
  onStatusChange,
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
          status={issue.status}
          dueDate={issue.dueDate}
          externalUrl={issue.externalUrl}
          isUnassigned={issue.isUnassigned}
          providerCreatedAt={issue.providerCreatedAt}
          providerUpdatedAt={issue.providerUpdatedAt}
          providerIconUrl={issue.project.issueProvider.iconUrl}
          providerName={issue.project.issueProvider.displayName}
          projectName={issue.project.displayName}
          onStatusChange={onStatusChange}
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
