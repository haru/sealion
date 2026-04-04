"use client";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import KeyboardDoubleArrowUpIcon from "@mui/icons-material/KeyboardDoubleArrowUp";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { type SortCriterion, VALID_SORT_CRITERIA } from "@/lib/types";

interface SortOrderSectionProps {
  /** Current ordered list of active sort criteria. */
  value: SortCriterion[];
  /**
   * Callback invoked when the active criteria list changes.
   * @param updated - New ordered array of active sort criteria.
   */
  onChange: (updated: SortCriterion[]) => void;
}

/**
 * Transfer-list UI for configuring the active sort criteria and their priority order.
 *
 * - Left list ("Available"): criteria not currently in use. Select and click → to activate.
 * - Right list ("Active"): active criteria in priority order. Select and click ← to deactivate,
 *   or use the ↑↑/↑/↓/↓↓ buttons on the right to reorder.
 *
 * @param props - {@link SortOrderSectionProps}
 */
export default function SortOrderSection({ value, onChange }: SortOrderSectionProps) {
  const t = useTranslations("boardSettings.sortOrder");

  const [selectedAvailable, setSelectedAvailable] = useState<SortCriterion | null>(null);
  const [selectedActive, setSelectedActive] = useState<SortCriterion | null>(null);

  const available = VALID_SORT_CRITERIA.filter((c) => !value.includes(c));
  const activeIndex = selectedActive !== null ? value.indexOf(selectedActive) : -1;

  /**
   * Selects an item in the available list; clears any active selection.
   * @param criterion - The criterion that was clicked.
   */
  function handleSelectAvailable(criterion: SortCriterion) {
    setSelectedAvailable((prev) => (prev === criterion ? null : criterion));
    setSelectedActive(null);
  }

  /**
   * Selects an item in the active list; clears any available selection.
   * @param criterion - The criterion that was clicked.
   */
  function handleSelectActive(criterion: SortCriterion) {
    setSelectedActive((prev) => (prev === criterion ? null : criterion));
    setSelectedAvailable(null);
  }

  /** Moves the selected available item to the end of the active list. */
  function add() {
    if (!selectedAvailable) { return; }
    onChange([...value, selectedAvailable]);
    setSelectedAvailable(null);
  }

  /** Moves the selected active item back to the available list. */
  function remove() {
    if (!selectedActive) { return; }
    onChange(value.filter((c) => c !== selectedActive));
    setSelectedActive(null);
  }

  /** Moves the selected active item to the top of the list (highest priority). */
  function moveToTop() {
    if (!selectedActive) { return; }
    onChange([selectedActive, ...value.filter((c) => c !== selectedActive)]);
  }

  /** Moves the selected active item one position up. */
  function moveUp() {
    if (!selectedActive || activeIndex <= 0) { return; }
    const next = [...value];
    [next[activeIndex - 1], next[activeIndex]] = [next[activeIndex], next[activeIndex - 1]];
    onChange(next);
  }

  /** Moves the selected active item one position down. */
  function moveDown() {
    if (!selectedActive || activeIndex === value.length - 1) { return; }
    const next = [...value];
    [next[activeIndex + 1], next[activeIndex]] = [next[activeIndex], next[activeIndex + 1]];
    onChange(next);
  }

  /** Moves the selected active item to the bottom of the list (lowest priority). */
  function moveToBottom() {
    if (!selectedActive) { return; }
    onChange([...value.filter((c) => c !== selectedActive), selectedActive]);
  }

  const atTop = !selectedActive || activeIndex === 0;
  const atBottom = !selectedActive || activeIndex === value.length - 1;

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      {/* Left: available (inactive) criteria */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          {t("availableLabel")}
        </Typography>
        <Paper variant="outlined" sx={{ minHeight: 120 }}>
          <List dense disablePadding>
            {available.map((criterion) => (
              <ListItemButton
                key={criterion}
                selected={selectedAvailable === criterion}
                onClick={() => handleSelectAvailable(criterion)}
                data-testid="sort-available-item"
              >
                <ListItemText primary={t(criterion)} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Box>

      {/* Center: transfer buttons */}
      <Stack spacing={1} sx={{ pt: 3.5 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={add}
          disabled={!selectedAvailable}
          data-testid="sort-add-btn"
          aria-label={t("addAriaLabel")}
          sx={{ minWidth: 44 }}
        >
          →
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={remove}
          disabled={!selectedActive}
          data-testid="sort-remove-btn"
          aria-label={t("removeAriaLabel")}
          sx={{ minWidth: 44 }}
        >
          ←
        </Button>
      </Stack>

      {/* Right: active criteria in priority order */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          {t("activeLabel")}
        </Typography>
        <Paper variant="outlined" sx={{ minHeight: 120 }}>
          <List dense disablePadding>
            {value.map((criterion) => (
              <ListItemButton
                key={criterion}
                selected={selectedActive === criterion}
                onClick={() => handleSelectActive(criterion)}
                data-testid="sort-active-item"
              >
                <ListItemText primary={t(criterion)} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Box>

      {/* Right side: reorder buttons */}
      <Stack spacing={0.5} sx={{ pt: 3.5 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={moveToTop}
          disabled={atTop}
          data-testid="sort-move-top"
          aria-label={t("moveTopAriaLabel")}
          sx={{ minWidth: 36, px: 0.5 }}
        >
          <KeyboardDoubleArrowUpIcon fontSize="small" />
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={moveUp}
          disabled={atTop}
          data-testid="sort-move-up"
          aria-label={t("moveUpAriaLabel")}
          sx={{ minWidth: 36, px: 0.5 }}
        >
          <KeyboardArrowUpIcon fontSize="small" />
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={moveDown}
          disabled={atBottom}
          data-testid="sort-move-down"
          aria-label={t("moveDownAriaLabel")}
          sx={{ minWidth: 36, px: 0.5 }}
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={moveToBottom}
          disabled={atBottom}
          data-testid="sort-move-bottom"
          aria-label={t("moveBottomAriaLabel")}
          sx={{ minWidth: 36, px: 0.5 }}
        >
          <KeyboardDoubleArrowDownIcon fontSize="small" />
        </Button>
      </Stack>
    </Box>
  );
}
