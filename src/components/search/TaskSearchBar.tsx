"use client";

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { TextField, InputAdornment, IconButton, Box } from "@mui/material";
import { useTranslations } from "next-intl";
import { useState, useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";

import type { TaskFilterState } from "@/hooks/useTaskSearch";
import { parseSearchQuery } from "@/lib/search-parser";

import SearchFilterDropdown from "./SearchFilterDropdown";

/**
 * The three phases of the search input state machine.
 * - `"closed"` — normal text search mode; the parent's `value` is displayed.
 * - `"selectKey"` — filter key selection; the input shows `localInput` and the
 *   dropdown lists filter key names filtered by that text.
 * - `"selectValue"` — filter value selection; the input shows `"<KeyLabel>:<localInput>"`
 *   and the dropdown lists values for `pendingKey` filtered by `localInput`.
 */
type DropdownPhase = "closed" | "selectKey" | "selectValue";

/** Maps each filter key to its raw query token prefix (as used by the parser). */
const FILTER_KEY_PREFIX: Record<keyof TaskFilterState, string> = {
  provider: "provider",
  project: "project",
  dueDateFilter: "dueDate",
  createdFilter: "createdDate",
  updatedFilter: "updatedDate",
  assignee: "assignee",
};

/** The ordered list of filterable keys (must match SearchFilterDropdown). */
const FILTER_KEYS: (keyof TaskFilterState)[] = [
  "provider",
  "project",
  "dueDateFilter",
  "createdFilter",
  "updatedFilter",
  "assignee",
];

/**
 * Removes any existing `prefix:value` or `prefix:"quoted value"` token from `text`.
 * @param text - The raw query text.
 * @param prefix - The filter token prefix to remove (e.g. "provider").
 * @returns The text with the token removed and extra whitespace cleaned up.
 */
function removeFilterToken(text: string, prefix: string): string {
  return text
    .replace(new RegExp(`(?:^|\\s+)${prefix}:(?:"[^"]*"|[^\\s]+)`, "g"), " ")
    .trim()
    .replace(/\s{2,}/g, " ");
}

/**
 * Converts a filter key+value pair into a query token string.
 * Returns `null` when `val` is `undefined` (meaning "remove this filter").
 * @param key - The filter field key.
 * @param val - The filter value, or `undefined` to clear.
 * @returns A token string like `"provider:GITHUB"` or `"project:\"My Project\""`, or `null`.
 */
function filterValueToTokenText(
  key: keyof TaskFilterState,
  val: TaskFilterState[keyof TaskFilterState]
): string | null {
  if (val === undefined) { return null; }

  if (key === "provider" || key === "project" || key === "assignee") {
    const s = val as string;
    return s.includes(" ") ? `"${s}"` : s;
  }

  // Date filter — val is { preset: string }
  return (val as { preset: string }).preset;
}

/**
 * Appends or replaces a filter token in the raw query text.
 * If `val` is `undefined`, the existing token for `key` is removed without replacement.
 * @param currentText - The current raw query text.
 * @param key - The filter field key.
 * @param val - The new filter value, or `undefined` to clear.
 * @returns The updated raw query text.
 */
function appendOrReplaceFilterInText(
  currentText: string,
  key: keyof TaskFilterState,
  val: TaskFilterState[keyof TaskFilterState]
): string {
  const prefix = FILTER_KEY_PREFIX[key];
  const cleaned = removeFilterToken(currentText, prefix);
  const valueText = filterValueToTokenText(key, val);
  if (valueText === null) { return cleaned; }
  const token = `${prefix}:${valueText}`;
  return cleaned.length > 0 ? `${cleaned} ${token}` : token;
}

/** Props for the {@link TaskSearchBar} component. */
export interface TaskSearchBarProps {
  /** Current raw text value of the search input. */
  value: string;
  /** Called when the user changes the search text (including filter token appends). */
  onSearch: (query: string) => void;
  /** Called when the user clears the text input. */
  onClear: () => void;
  /** Provider types to display in the filter dropdown. */
  availableProviders: string[];
  /** Project display names to display in the filter dropdown. */
  availableProjects: string[];
  /** Whether there are no results for the current search/filter state. */
  hasNoResults: boolean;
}

/**
 * The main search bar component.
 *
 * Implements a GitHub Issues–style three-phase state machine:
 * 1. **closed** — plain text search; dropdown is hidden.
 * 2. **selectKey** — shows filter key options filtered by typed text.
 * 3. **selectValue** — shows value options for the chosen filter key;
 *    the input displays `"<KeyLabel>:<typed text>"`.
 *
 * Filter selections are appended to the raw text as `key:value` tokens
 * (e.g. `provider:GITHUB`) so they are visible inside the search box.
 * Users can also type filter tokens directly without using the dropdown.
 *
 * @param props - {@link TaskSearchBarProps}
 */
export default function TaskSearchBar({
  value,
  onSearch,
  onClear,
  availableProviders,
  availableProjects,
  hasNoResults,
}: TaskSearchBarProps) {
  const t = useTranslations("search");

  // ── Phase state machine ───────────────────────────────────────────────────
  const [phase, setPhase] = useState<DropdownPhase>("closed");
  /** The filter key chosen in selectKey phase, active during selectValue phase. */
  const [pendingKey, setPendingKey] = useState<keyof TaskFilterState | null>(null);
  /**
   * In selectKey phase: the text typed to filter key names.
   * In selectValue phase: the text typed after the key prefix to filter values.
   */
  const [localInput, setLocalInput] = useState("");

  // ── Anchor element for the Popover ────────────────────────────────────────
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

  /**
   * Prevents `onFocus` from re-opening the dropdown immediately after it was
   * suppressed (e.g. when focus returns to the TextField after a value is selected).
   */
  const suppressNextFocusRef = useRef(false);

  /** Captures the TextField root DOM node as the popover anchor. */
  const handleRef = useCallback((node: HTMLDivElement | null) => {
    setAnchorEl(node);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  /** Returns the human-readable label for a filter key. */
  function getKeyLabel(key: keyof TaskFilterState): string {
    const labels: Record<keyof TaskFilterState, string> = {
      provider: t("provider"),
      project: t("project"),
      dueDateFilter: t("dueDateFilter"),
      createdFilter: t("createdFilter"),
      updatedFilter: t("updatedFilter"),
      assignee: t("assignee"),
    };
    return labels[key];
  }

  /**
   * The value to display in the TextField.
   * - closed phase → parent's `value` (the free-text query with embedded tokens)
   * - selectKey phase → `localInput` (text typed to filter key names)
   * - selectValue phase → `"<KeyLabel>:<localInput>"` (prefix + value filter text)
   */
  let displayValue: string;
  if (phase === "selectKey") {
    displayValue = localInput;
  } else if (phase === "selectValue" && pendingKey) {
    displayValue = `${getKeyLabel(pendingKey)}:${localInput}`;
  } else {
    displayValue = value;
  }

  const hasContent = value.trim().length > 0;

  /** Active filters derived from the current raw query text (for dropdown state). */
  const activeFilters: TaskFilterState = (() => {
    if (!value.trim()) { return {}; }
    const p = parseSearchQuery(value);
    return {
      provider: p.provider,
      project: p.project,
      dueDateFilter: p.dueDateFilter,
      createdFilter: p.createdFilter,
      updatedFilter: p.updatedFilter,
      assignee: p.assignee,
    };
  })();

  // ── Event handlers ────────────────────────────────────────────────────────

  /**
   * Opens the selectKey phase when the input is focused while empty.
   * Does nothing if the input already contains a search query (closed phase with text).
   */
  function handleFocus() {
    if (suppressNextFocusRef.current) {
      suppressNextFocusRef.current = false;
      return;
    }
    if (value.trim() === "" && phase === "closed") {
      setPhase("selectKey");
      setLocalInput("");
    }
  }

  /**
   * Handles input value changes for all three phases.
   * @param newText - The new input text after the change.
   */
  function handleChange(newText: string) {
    if (phase === "selectKey") {
      setLocalInput(newText);
      // Check whether any key name still starts with the typed text
      const hasMatch = FILTER_KEYS.some(
        (k) =>
          newText.length === 0 ||
          getKeyLabel(k).toLowerCase().startsWith(newText.toLowerCase())
      );
      if (newText.length > 0 && !hasMatch) {
        // No filter key matches → promote to free-text search
        setPhase("closed");
        setLocalInput("");
        onSearch(newText);
      }
    } else if (phase === "selectValue" && pendingKey) {
      const prefix = `${getKeyLabel(pendingKey)}:`;
      if (newText.startsWith(prefix)) {
        // User is typing after the prefix → update value filter text
        setLocalInput(newText.slice(prefix.length));
      } else {
        // User deleted into the prefix → go back to key selection
        setPhase("selectKey");
        setPendingKey(null);
        setLocalInput("");
      }
    } else {
      // closed phase → normal text search
      onSearch(newText);
    }
  }

  /**
   * Handles keyboard shortcuts:
   * - `Escape` in selectValue → back to selectKey
   * - `Escape` in selectKey → close dropdown (closed phase)
   * - `Escape` in closed → nothing special beyond blur
   */
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (phase === "selectValue") {
        setPhase("selectKey");
        setPendingKey(null);
        setLocalInput("");
      } else if (phase === "selectKey") {
        setPhase("closed");
        setLocalInput("");
      }
    }
  }

  /**
   * Called when the user selects a filter key in the dropdown.
   * Transitions to selectValue phase.
   * @param key - The selected filter key.
   */
  function handleKeySelect(key: keyof TaskFilterState) {
    setPendingKey(key);
    setPhase("selectValue");
    setLocalInput("");
  }

  /**
   * Called when the user selects a filter value in the dropdown.
   * Appends or replaces the corresponding `key:value` token in the raw query text,
   * then returns to closed phase.
   * @param key - The filter key.
   * @param val - The selected value, or `undefined` to remove the token.
   */
  function handleValueSelect(
    key: keyof TaskFilterState,
    val: TaskFilterState[keyof TaskFilterState]
  ) {
    const newText = appendOrReplaceFilterInText(value, key, val);
    onSearch(newText);
    setPhase("closed");
    setPendingKey(null);
    setLocalInput("");
    suppressNextFocusRef.current = true;
  }

  /** Closes the dropdown and returns to closed phase (e.g. click outside Popover). */
  const handleCloseDropdown = useCallback(() => {
    setPhase("closed");
    setPendingKey(null);
    setLocalInput("");
    suppressNextFocusRef.current = true;
  }, []);

  /** Clears the text query. */
  function handleClearAll() {
    onClear();
    setPhase("closed");
    setPendingKey(null);
    setLocalInput("");
    suppressNextFocusRef.current = true;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <TextField
        ref={handleRef}
        fullWidth
        size="small"
        placeholder={t("placeholder")}
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
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
      />

      {hasNoResults && (
        <Box sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>
          {t("noResults")}
        </Box>
      )}

      <SearchFilterDropdown
        open={phase !== "closed"}
        anchorEl={anchorEl}
        mode={phase === "selectValue" ? "selectValue" : "selectKey"}
        filterText={phase === "selectKey" ? localInput : ""}
        valueFilterText={phase === "selectValue" ? localInput : ""}
        pendingFilterKey={pendingKey}
        availableProviders={availableProviders}
        availableProjects={availableProjects}
        activeFilters={activeFilters}
        onKeySelect={handleKeySelect}
        onValueSelect={handleValueSelect}
        onClose={handleCloseDropdown}
      />
    </Box>
  );
}
