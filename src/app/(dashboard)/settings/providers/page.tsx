"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Container,
  Typography,
  Paper,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { useTranslations } from "next-intl";
import ProviderList from "@/components/providers/ProviderList";
import ProviderForm from "@/components/providers/ProviderForm";

interface Provider {
  id: string;
  type: "GITHUB" | "JIRA" | "REDMINE";
  displayName: string;
}

export default function ProvidersPage() {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");

  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      const json = await res.json();
      if (res.ok) setProviders(json.data);
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProviders();
  }, [fetchProviders]);

  async function handleAddProvider(data: {
    type: "GITHUB" | "JIRA" | "REDMINE";
    displayName: string;
    credentials: Record<string, string>;
  }) {
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? tCommon("error"));
    }

    await fetchProviders();
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;

    const res = await fetch(`/api/providers/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setProviders((prev) => prev.filter((p) => p.id !== deleteId));
    } else {
      setError(tCommon("error"));
    }
    setDeleteId(null);
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("title")}
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <ProviderList providers={providers} onDelete={(id) => setDeleteId(id)} />
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t("addProvider")}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <ProviderForm onSubmit={handleAddProvider} />
      </Paper>

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
