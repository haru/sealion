"use client";

import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Container,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";

import AddProviderDialog from "@/components/providers/AddProviderDialog";
import type { ProviderFormData } from "@/components/providers/ProviderForm";
import ProviderList from "@/components/providers/ProviderList";
import { useMessageQueue } from "@/hooks/useMessageQueue";
import { usePageHeader } from "@/hooks/usePageHeader";
import { formatProviderApiError, type ProviderApiErrorResponse } from "@/lib/error-utils";

interface Provider {
  id: string;
  type: "GITHUB" | "JIRA" | "REDMINE" | "GITLAB";
  displayName: string;
  baseUrl: string | null;
  iconUrl: string | null;
}

/** Providers settings page for adding, editing, and deleting issue providers. */
export default function ProvidersPage() {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");
  const tSync = useTranslations("sync");

  const { addMessage } = useMessageQueue();
  usePageHeader(t("title"), undefined, SettingsIcon);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        addMessage("error", tCommon("error"));
        return;
      }
      if (res.ok) {
        setProviders((json as { data: Provider[] }).data);
      } else {
        addMessage("error", tCommon("error"));
      }
    } catch {
      addMessage("error", tCommon("error"));
    }
  }, [tCommon, addMessage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProviders();
  }, [fetchProviders]);

  /** Sends a new provider to the API and refreshes the list on success. */
  async function handleAddProvider(data: ProviderFormData) {
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(tCommon("error"));
    }

    if (!res.ok) {
      throw new Error(formatProviderApiError(json as ProviderApiErrorResponse, tSync, tCommon("error")));
    }

    await fetchProviders();
  }

  /** Sends the delete request for the currently selected provider. */
  async function handleDeleteConfirm() {
    if (!deleteId) { return; }

    const res = await fetch(`/api/providers/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setProviders((prev) => prev.filter((p) => p.id !== deleteId));
    } else {
      addMessage("error", tCommon("error"));
    }
    setDeleteId(null);
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          {t("addProvider")}
        </Button>
      </Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <ProviderList
          providers={providers}
          onDelete={(id) => setDeleteId(id)}
          onUpdated={(updated) =>
            setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }
        />
      </Paper>

      <AddProviderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddProvider}
      />

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>{tCommon("delete")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("deleteConfirm")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>{tCommon("cancel")}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
