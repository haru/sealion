"use client";

import { Chip } from "@mui/material";
import { useTranslations } from "next-intl";

import type { TaskFilterState } from "@/hooks/useTaskSearch";

/** Props for the {@link SearchFilterToken} component. */
export interface SearchFilterTokenProps {
  /** The filter key this token represents. */
  filterKey: keyof TaskFilterState;
  /** The current value of the filter. */
  value: TaskFilterState[keyof TaskFilterState];
  /**
   * Called when the delete icon is clicked.
   * @param key - The filter key to clear.
   */
  onDelete: (key: keyof TaskFilterState) => void;
}

/**
 * Renders a single active filter as a deletable MUI Chip token.
 * Displays a human-readable label derived from the filter key and value.
 * @param props - {@link SearchFilterTokenProps}
 */
export default function SearchFilterToken({
  filterKey,
  value,
  onDelete,
}: SearchFilterTokenProps) {
  const t = useTranslations("search");

  const filterLabel = buildLabel(filterKey, value, t);

  return (
    <Chip
      data-testid="search-filter-token"
      label={filterLabel}
      onDelete={() => onDelete(filterKey)}
      size="small"
      sx={{ maxWidth: 180 }}
    />
  );
}

/** Maps filter key to a translated section label. */
function keyLabel(filterKey: keyof TaskFilterState, t: ReturnType<typeof useTranslations<"search">>) {
  switch (filterKey) {
    case "provider": return t("provider");
    case "project": return t("project");
    case "dueDateFilter": return t("dueDate");
    case "createdFilter": return t("createdDate");
    case "updatedFilter": return t("updatedDate");
    case "assignee": return t("assignee");
  }
}

/** Maps a preset value to a translated label. */
function presetLabel(preset: string, t: ReturnType<typeof useTranslations<"search">>) {
  switch (preset) {
    case "today": return t("today");
    case "thisWeek": return t("thisWeek");
    case "thisMonth": return t("thisMonth");
    case "pastYear": return t("pastYear");
    case "none": return t("noDeadline");
    case "past7days": return t("past7days");
    case "past30days": return t("past30days");
    default: return preset;
  }
}

/**
 * Builds the human-readable chip label for a filter key+value pair.
 * @param filterKey - The filter field key.
 * @param value - The filter value.
 * @param t - next-intl translator for the "search" namespace.
 * @returns A human-readable label string.
 */
function buildLabel(
  filterKey: keyof TaskFilterState,
  value: TaskFilterState[keyof TaskFilterState],
  t: ReturnType<typeof useTranslations<"search">>
): string {
  const section = keyLabel(filterKey, t);

  if (filterKey === "assignee" && typeof value === "string") {
    const valLabel = value === "unassigned" ? t("unassigned") : t("assigned");
    return `${section}: ${valLabel}`;
  }

  if (
    (filterKey === "dueDateFilter" || filterKey === "createdFilter" || filterKey === "updatedFilter") &&
    value != null &&
    typeof value === "object" &&
    "preset" in value
  ) {
    return `${section}: ${presetLabel((value as { preset: string }).preset, t)}`;
  }

  if (typeof value === "string") {
    return `${section}: ${value}`;
  }

  return section;
}
