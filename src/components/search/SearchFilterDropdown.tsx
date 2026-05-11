"use client";

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import EventIcon from "@mui/icons-material/Event";
import FolderIcon from "@mui/icons-material/Folder";
import PersonIcon from "@mui/icons-material/Person";
import StorageIcon from "@mui/icons-material/Storage";
import UpdateIcon from "@mui/icons-material/Update";
import { Popover, Box, Typography, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { useTranslations } from "next-intl";

import type { TaskFilterState } from "@/hooks/useTaskSearch";
import type { DateRangePreset, CreatedUpdatedPreset } from "@/lib/search/search-parser";

/** The ordered list of filterable keys shown in selectKey mode. */
const FILTER_KEYS: (keyof TaskFilterState)[] = [
  "provider",
  "project",
  "dueDateFilter",
  "createdFilter",
  "updatedFilter",
  "assignee",
];

/** Translation key for each filter field. */
type SearchTranslationKey =
  | "provider"
  | "project"
  | "dueDateFilter"
  | "createdFilter"
  | "updatedFilter"
  | "assignee";

/** Maps each filter field key to its translation key in the "search" namespace. */
const FILTER_KEY_LABEL: Record<keyof TaskFilterState, SearchTranslationKey> = {
  provider: "provider",
  project: "project",
  dueDateFilter: "dueDateFilter",
  createdFilter: "createdFilter",
  updatedFilter: "updatedFilter",
  assignee: "assignee",
};

/**
 * Returns the MUI icon component for the given filter key.
 * @param key - The filter field key.
 * @returns A MUI SvgIcon-compatible React component.
 */
function filterKeyIcon(key: keyof TaskFilterState) {
  switch (key) {
    case "provider": return StorageIcon;
    case "project": return FolderIcon;
    case "dueDateFilter": return EventIcon;
    case "createdFilter": return AddCircleOutlineIcon;
    case "updatedFilter": return UpdateIcon;
    case "assignee": return PersonIcon;
  }
}

/** Props for the {@link SearchFilterDropdown} component. */
export interface SearchFilterDropdownProps {
  /** Whether the dropdown popover is open. */
  open: boolean;
  /** Anchor element for the Popover. */
  anchorEl: HTMLElement | null;
  /**
   * The current display phase.
   * - `"selectKey"` renders filter key options (Provider, Project, …).
   * - `"selectValue"` renders value options for `pendingFilterKey`.
   */
  mode: "selectKey" | "selectValue";
  /**
   * Text typed by the user in selectKey mode.
   * Used to filter key option names with a case-insensitive prefix match.
   */
  filterText: string;
  /**
   * Text typed by the user after the key prefix in selectValue mode.
   * Used to filter value options with a case-insensitive prefix match.
   */
  valueFilterText: string;
  /** The filter key being drilled into; only relevant in selectValue mode. */
  pendingFilterKey: keyof TaskFilterState | null;
  /** Provider types available for selection. */
  availableProviders: string[];
  /** Project display names available for selection. */
  availableProjects: string[];
  /** Currently active filter state, used to mark selected values. */
  activeFilters: TaskFilterState;
  /**
   * Called when the user selects a filter key in selectKey mode.
   * @param key - The selected filter field key.
   */
  onKeySelect: (key: keyof TaskFilterState) => void;
  /**
   * Called when the user selects (or toggles off) a filter value in selectValue mode.
   * @param key - The filter field key.
   * @param value - The selected value, or `undefined` to clear.
   */
  onValueSelect: (
    key: keyof TaskFilterState,
    value: TaskFilterState[keyof TaskFilterState]
  ) => void;
  /** Called when the popover should close (e.g. click outside). */
  onClose: () => void;
}

/**
 * Two-phase filter dropdown anchored to the search input.
 *
 * In `"selectKey"` mode it shows the list of filter dimensions filtered by `filterText`.
 * In `"selectValue"` mode it shows the values for `pendingFilterKey` filtered by `valueFilterText`.
 *
 * @param props - {@link SearchFilterDropdownProps}
 */
export default function SearchFilterDropdown({
  open,
  anchorEl,
  mode,
  filterText,
  valueFilterText,
  pendingFilterKey,
  availableProviders,
  availableProjects,
  activeFilters,
  onKeySelect,
  onValueSelect,
  onClose,
}: SearchFilterDropdownProps) {
  const t = useTranslations("search");

  const popoverProps = {
    anchorEl,
    onClose,
    anchorOrigin: { vertical: "bottom" as const, horizontal: "left" as const },
    transformOrigin: { vertical: "top" as const, horizontal: "left" as const },
    disableAutoFocus: true,
    disableEnforceFocus: true,
    PaperProps: { sx: { width: 240, maxHeight: 400, overflow: "auto", mt: 0.5 } },
  };

  // ── selectKey mode ────────────────────────────────────────────────────────
  if (mode === "selectKey") {
    const visibleKeys = FILTER_KEYS.filter(
      (k) =>
        filterText.length === 0 ||
        t(FILTER_KEY_LABEL[k]).toLowerCase().startsWith(filterText.toLowerCase())
    );

    return (
      <Popover open={open && visibleKeys.length > 0} {...popoverProps}>
        <Box sx={{ py: 1 }}>
          <Typography
            variant="overline"
            sx={{ px: 2, color: "text.secondary", display: "block", mb: 0.5 }}
          >
            {t("filterBy")}
          </Typography>
          {visibleKeys.map((key) => {
            const Icon = filterKeyIcon(key);
            return (
              <MenuItem key={key} dense onClick={() => onKeySelect(key)}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t(FILTER_KEY_LABEL[key])} />
              </MenuItem>
            );
          })}
        </Box>
      </Popover>
    );
  }

  // ── selectValue mode ──────────────────────────────────────────────────────
  if (!pendingFilterKey) { return null; }

  const items = buildValueItems(
    pendingFilterKey,
    availableProviders,
    availableProjects,
    activeFilters,
    t
  );

  const visibleItems = items.filter(
    (item) =>
      valueFilterText.length === 0 ||
      item.label.toLowerCase().startsWith(valueFilterText.toLowerCase())
  );

  return (
    <Popover open={open} {...popoverProps}>
      <Box sx={{ py: 1 }}>
        <Typography
          variant="overline"
          sx={{ px: 2, color: "text.secondary", display: "block", mb: 0.5 }}
        >
          {t(FILTER_KEY_LABEL[pendingFilterKey])}
        </Typography>
        {visibleItems.map((item) => (
          <MenuItem
            key={item.value}
            dense
            selected={item.selected}
            onClick={() => onValueSelect(pendingFilterKey, item.filterValue)}
          >
            {item.label}
          </MenuItem>
        ))}
      </Box>
    </Popover>
  );
}

// ── Value item helpers ────────────────────────────────────────────────────────

/** A single selectable value row in the value dropdown. */
interface ValueItem {
  /** Unique key for the row (used as React key). */
  value: string;
  /** Display label. */
  label: string;
  /** Whether this value is currently active. */
  selected: boolean;
  /** The value to pass to `onValueSelect`; `undefined` when toggling off. */
  filterValue: TaskFilterState[keyof TaskFilterState];
}

/**
 * Builds the list of value items for a given filter key.
 * @param key - The filter field key.
 * @param availableProviders - Registered provider type strings.
 * @param availableProjects - Registered project display names.
 * @param activeFilters - Current active filter state.
 * @param t - next-intl translator for the "search" namespace.
 * @returns An array of {@link ValueItem}s.
 */
function buildValueItems(
  key: keyof TaskFilterState,
  availableProviders: string[],
  availableProjects: string[],
  activeFilters: TaskFilterState,
  t: ReturnType<typeof useTranslations<"search">>
): ValueItem[] {
  switch (key) {
    case "provider":
      return availableProviders.map((p) => ({
        value: p,
        label: p,
        selected: activeFilters.provider === p,
        filterValue: activeFilters.provider === p ? undefined : p,
      }));

    case "project":
      return availableProjects.map((p) => ({
        value: p,
        label: p,
        selected: activeFilters.project === p,
        filterValue: activeFilters.project === p ? undefined : p,
      }));

    case "dueDateFilter": {
      const opts: { preset: DateRangePreset; label: string }[] = [
        { preset: "today", label: t("today") },
        { preset: "thisWeek", label: t("thisWeek") },
        { preset: "thisMonth", label: t("thisMonth") },
        { preset: "none", label: t("noDeadline") },
      ];
      return opts.map(({ preset, label }) => ({
        value: preset,
        label,
        selected: activeFilters.dueDateFilter?.preset === preset,
        filterValue:
          activeFilters.dueDateFilter?.preset === preset
            ? undefined
            : { preset },
      }));
    }

    case "createdFilter": {
      const opts: { preset: CreatedUpdatedPreset; label: string }[] = [
        { preset: "today", label: t("today") },
        { preset: "past7days", label: t("past7days") },
        { preset: "past30days", label: t("past30days") },
        { preset: "pastYear", label: t("pastYear") },
      ];
      return opts.map(({ preset, label }) => ({
        value: preset,
        label,
        selected: activeFilters.createdFilter?.preset === preset,
        filterValue:
          activeFilters.createdFilter?.preset === preset
            ? undefined
            : { preset },
      }));
    }

    case "updatedFilter": {
      const opts: { preset: CreatedUpdatedPreset; label: string }[] = [
        { preset: "today", label: t("today") },
        { preset: "past7days", label: t("past7days") },
        { preset: "past30days", label: t("past30days") },
        { preset: "pastYear", label: t("pastYear") },
      ];
      return opts.map(({ preset, label }) => ({
        value: preset,
        label,
        selected: activeFilters.updatedFilter?.preset === preset,
        filterValue:
          activeFilters.updatedFilter?.preset === preset
            ? undefined
            : { preset },
      }));
    }

    case "assignee":
      return [
        {
          value: "unassigned",
          label: t("unassigned"),
          selected: activeFilters.assignee === "unassigned",
          filterValue:
            activeFilters.assignee === "unassigned"
              ? undefined
              : ("unassigned" as const),
        },
        {
          value: "assigned",
          label: t("assigned"),
          selected: activeFilters.assignee === "assigned",
          filterValue:
            activeFilters.assignee === "assigned"
              ? undefined
              : ("assigned" as const),
        },
      ];
  }
}
