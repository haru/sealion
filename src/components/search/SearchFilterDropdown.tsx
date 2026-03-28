"use client";

import { Popover, Box, Typography, MenuItem, Divider } from "@mui/material";
import { useTranslations } from "next-intl";
import type { TaskFilterState } from "@/hooks/useTaskSearch";
import type { DateRangePreset } from "@/lib/search-parser";

/** A single selectable filter option. */
interface FilterOption {
  /** The value to pass to setFilter. */
  value: string;
  /** Display label (already translated). */
  label: string;
}

/** Props for the {@link SearchFilterDropdown} component. */
export interface SearchFilterDropdownProps {
  /** Whether the dropdown is open. */
  open: boolean;
  /** Anchor element for the Popover. */
  anchorEl: HTMLElement | null;
  /** Provider types available for selection (e.g. ["GITHUB", "JIRA"]). */
  availableProviders: string[];
  /** Project display names available for selection. */
  availableProjects: string[];
  /** Currently active filter state. */
  activeFilters: TaskFilterState;
  /**
   * Called when a filter option is selected.
   * @param key - The filter field key.
   * @param value - The selected value, or undefined to clear.
   */
  onFilterSelect: (
    key: keyof TaskFilterState,
    value: TaskFilterState[keyof TaskFilterState]
  ) => void;
  /** Called when the popover should close. */
  onClose: () => void;
}

/**
 * A dropdown popover that renders filter sections for provider, project, due date,
 * created date, updated date, and assignee. Anchors to the search input element.
 * @param props - {@link SearchFilterDropdownProps}
 */
export default function SearchFilterDropdown({
  open,
  anchorEl,
  availableProviders,
  availableProjects,
  activeFilters,
  onFilterSelect,
  onClose,
}: SearchFilterDropdownProps) {
  const t = useTranslations("search");

  const dueDateOptions: FilterOption[] = [
    { value: "today", label: t("today") },
    { value: "thisWeek", label: t("thisWeek") },
    { value: "thisMonth", label: t("thisMonth") },
    { value: "noDeadline", label: t("noDeadline") },
  ];

  const dateRangeOptions: FilterOption[] = [
    { value: "today", label: t("today") },
    { value: "past7days", label: "Past 7 days" },
    { value: "past30days", label: "Past 30 days" },
    { value: "pastYear", label: t("pastYear") },
  ];

  const assigneeOptions: FilterOption[] = [
    { value: "unassigned", label: t("unassigned") },
    { value: "assigned", label: t("assigned") },
  ];

  /**
   * Forwards a filter selection to the parent and closes the dropdown.
   * @param key - The filter key to update.
   * @param value - The new filter value, or undefined to clear.
   */
  function handleSelect(
    key: keyof TaskFilterState,
    value: TaskFilterState[keyof TaskFilterState]
  ) {
    onFilterSelect(key, value);
    onClose();
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      disableAutoFocus
      disableEnforceFocus
      PaperProps={{ sx: { width: 280, maxHeight: 480, overflow: "auto", mt: 0.5 } }}
    >
      <Box sx={{ py: 1 }}>
        <Typography variant="overline" sx={{ px: 2, color: "text.secondary" }}>
          {t("filterBy")}
        </Typography>

        {availableProviders.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" sx={{ px: 2, color: "text.secondary", display: "block" }}>
              {t("provider")}
            </Typography>
            {availableProviders.map((prov) => (
              <MenuItem
                key={prov}
                selected={activeFilters.provider === prov}
                onClick={() =>
                  handleSelect(
                    "provider",
                    activeFilters.provider === prov ? undefined : prov
                  )
                }
                dense
              >
                {prov}
              </MenuItem>
            ))}
          </>
        )}

        {availableProjects.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" sx={{ px: 2, color: "text.secondary", display: "block" }}>
              {t("project")}
            </Typography>
            {availableProjects.map((proj) => (
              <MenuItem
                key={proj}
                selected={activeFilters.project === proj}
                onClick={() =>
                  handleSelect(
                    "project",
                    activeFilters.project === proj ? undefined : proj
                  )
                }
                dense
              >
                {proj}
              </MenuItem>
            ))}
          </>
        )}

        <Divider sx={{ my: 0.5 }} />
        <Typography variant="caption" sx={{ px: 2, color: "text.secondary", display: "block" }}>
          {t("dueDate")}
        </Typography>
        {dueDateOptions.map((opt) => {
          const presetValue = opt.value === "noDeadline" ? "none" : opt.value;
          return (
            <MenuItem
              key={opt.value}
              selected={activeFilters.dueDateFilter?.preset === presetValue}
              onClick={() =>
                handleSelect(
                  "dueDateFilter",
                  activeFilters.dueDateFilter?.preset === presetValue
                    ? undefined
                    : { preset: presetValue as DateRangePreset }
                )
              }
              dense
            >
              {opt.label}
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 0.5 }} />
        <Typography variant="caption" sx={{ px: 2, color: "text.secondary", display: "block" }}>
          {t("createdDate")}
        </Typography>
        {dateRangeOptions.map((opt) => (
          <MenuItem
            key={`created-${opt.value}`}
            selected={activeFilters.createdFilter?.preset === opt.value}
            onClick={() =>
              handleSelect(
                "createdFilter",
                activeFilters.createdFilter?.preset === opt.value
                  ? undefined
                  : { preset: opt.value as DateRangePreset }
              )
            }
            dense
          >
            {opt.label}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />
        <Typography variant="caption" sx={{ px: 2, color: "text.secondary", display: "block" }}>
          {t("updatedDate")}
        </Typography>
        {dateRangeOptions.map((opt) => (
          <MenuItem
            key={`updated-${opt.value}`}
            selected={activeFilters.updatedFilter?.preset === opt.value}
            onClick={() =>
              handleSelect(
                "updatedFilter",
                activeFilters.updatedFilter?.preset === opt.value
                  ? undefined
                  : { preset: opt.value as DateRangePreset }
              )
            }
            dense
          >
            {opt.label}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />
        <Typography variant="caption" sx={{ px: 2, color: "text.secondary", display: "block" }}>
          {t("assignee")}
        </Typography>
        {assigneeOptions.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={activeFilters.assignee === opt.value}
            onClick={() =>
              handleSelect(
                "assignee",
                activeFilters.assignee === opt.value ? undefined : (opt.value as "unassigned" | "assigned")
              )
            }
            dense
          >
            {opt.label}
          </MenuItem>
        ))}
      </Box>
    </Popover>
  );
}
