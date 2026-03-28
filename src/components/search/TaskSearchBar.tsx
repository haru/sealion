"use client";

import { useState, useCallback, useRef } from "react";
import { TextField, InputAdornment, IconButton, Box } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useTranslations } from "next-intl";
import type { TaskFilterState } from "@/hooks/useTaskSearch";
import SearchFilterDropdown from "./SearchFilterDropdown";
import SearchFilterToken from "./SearchFilterToken";

/** Props for the {@link TaskSearchBar} component. */
export interface TaskSearchBarProps {
  /** Current raw text value of the search input. */
  value: string;
  /** Active filter state to display as tokens. */
  filters: TaskFilterState;
  /** Called when the user changes the search text. */
  onSearch: (query: string) => void;
  /**
   * Called when a filter option is selected or cleared from the dropdown.
   * @param key - The filter key.
   * @param value - The new value, or undefined to clear.
   */
  onFilterSelect: (
    key: keyof TaskFilterState,
    value: TaskFilterState[keyof TaskFilterState]
  ) => void;
  /** Called when the user clears the text input. */
  onClear: () => void;
  /** Called when the clear-all-filters button is triggered. */
  onClearAllFilters: () => void;
  /** Provider types to display in the filter dropdown. */
  availableProviders: string[];
  /** Project display names to display in the filter dropdown. */
  availableProjects: string[];
  /** Whether there are no results for the current search/filter state. */
  hasNoResults: boolean;
}

/**
 * The main search bar component. Renders a text input with a search icon, clear button,
 * active filter tokens (chips), and a filter dropdown triggered by focusing the input.
 * @param props - {@link TaskSearchBarProps}
 */
export default function TaskSearchBar({
  value,
  filters,
  onSearch,
  onFilterSelect,
  onClear,
  onClearAllFilters,
  availableProviders,
  availableProjects,
  hasNoResults,
}: TaskSearchBarProps) {
  const t = useTranslations("search");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Store the anchor element in state so reading it in render is stable
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  // Prevents onFocus from re-opening the dropdown immediately after it was closed
  // (e.g. when focus returns to the TextField after clicking a MenuItem)
  const suppressNextFocusRef = useRef(false);

  const activeFilterKeys = Object.keys(filters).filter(
    (k) => filters[k as keyof TaskFilterState] !== undefined
  ) as (keyof TaskFilterState)[];

  const hasActiveFilters = activeFilterKeys.length > 0;
  const hasContent = value.trim().length > 0 || hasActiveFilters;

  /** Captures the TextField root DOM node as the popover anchor. */
  const handleRef = useCallback((node: HTMLDivElement | null) => {
    setAnchorEl(node);
  }, []);

  /** Opens the filter dropdown, unless suppressed after a programmatic close. */
  function handleFocus() {
    if (suppressNextFocusRef.current) {
      suppressNextFocusRef.current = false;
      return;
    }
    setDropdownOpen(true);
  }

  /** Closes the dropdown and suppresses the next onFocus re-open. */
  const closeDropdown = useCallback(() => {
    suppressNextFocusRef.current = true;
    setDropdownOpen(false);
  }, []);

  /** Closes the dropdown on Enter/Escape keys. */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Escape") {
      closeDropdown();
    }
  }

  /** Clears both the text query and all active filters. */
  function handleClearAll() {
    onClear();
    onClearAllFilters();
    closeDropdown();
  }

  return (
    <Box>
      <TextField
        ref={handleRef}
        fullWidth
        size="small"
        placeholder={t("placeholder")}
        value={value}
        onChange={(e) => onSearch(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: hasContent ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label={t("clearSearch")}
                  onClick={handleClearAll}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
        sx={{ mb: activeFilterKeys.length > 0 ? 1 : 0 }}
      />

      {activeFilterKeys.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          {activeFilterKeys.map((key) => (
            <SearchFilterToken
              key={key}
              filterKey={key}
              value={filters[key]}
              onDelete={(k) => onFilterSelect(k, undefined)}
            />
          ))}
        </Box>
      )}

      {hasNoResults && (
        <Box sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>
          {t("noResults")}
        </Box>
      )}

      <SearchFilterDropdown
        open={dropdownOpen}
        anchorEl={anchorEl}
        availableProviders={availableProviders}
        availableProjects={availableProjects}
        activeFilters={filters}
        onFilterSelect={(key, val) => {
          onFilterSelect(key, val);
          closeDropdown();
        }}
        onClose={closeDropdown}
      />
    </Box>
  );
}
