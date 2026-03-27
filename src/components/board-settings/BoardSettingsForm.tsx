"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { BoardSettings, DEFAULT_BOARD_SETTINGS, SortCriterion } from "@/lib/types";
import DisplayItemsSection from "./DisplayItemsSection";
import SortOrderSection from "./SortOrderSection";
import { useMessageQueue } from "@/hooks/useMessageQueue";

/**
 * Client component that fetches the user's board settings and renders
 * the display items and sort order configuration UI.
 * Submits changes via PUT /api/board-settings.
 */
export default function BoardSettingsForm() {
  const t = useTranslations("boardSettings");

  const { addMessage } = useMessageQueue();
  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/board-settings")
      .then(async (res) => {
        if (!res.ok) {
          setError(t("loadError"));
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          if (json.error) {
            setError(t("loadError"));
          } else if (json.data) {
            setSettings(json.data as BoardSettings);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  /** Handles save button click — sends PUT /api/board-settings. */
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/board-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(t("saveError"));
      } else {
        setSettings(json.data as BoardSettings);
        addMessage("information", t("saveSuccess"));
      }
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <section>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          {t("displayItems.sectionTitle")}
        </Typography>
        <DisplayItemsSection
          showCreatedAt={settings.showCreatedAt}
          showUpdatedAt={settings.showUpdatedAt}
          onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        />
      </section>

      <section>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          {t("sortOrder.sectionTitle")}
        </Typography>
        <SortOrderSection
          value={settings.sortOrder}
          onChange={(sortOrder: SortCriterion[]) => setSettings((prev) => ({ ...prev, sortOrder }))}
        />
      </section>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {t("save")}
        </Button>
      </Box>

    </Box>
  );
}
