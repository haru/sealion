"use client";

import { Box, Pagination, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import TodoItem from "./TodoItem";
import TodoListSkeleton from "./TodoListSkeleton";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status = "OPEN" | "CLOSED";

interface Issue {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
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
}

export default function TodoList({
  items,
  total,
  page,
  limit,
  loading,
  onPageChange,
  onStatusChange,
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
          title={issue.title}
          status={issue.status}
          priority={issue.priority}
          dueDate={issue.dueDate}
          externalUrl={issue.externalUrl}
          isUnassigned={issue.isUnassigned}
          providerIconUrl={issue.project.issueProvider.iconUrl}
          providerName={issue.project.issueProvider.displayName}
          projectName={issue.project.displayName}
          onStatusChange={onStatusChange}
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
