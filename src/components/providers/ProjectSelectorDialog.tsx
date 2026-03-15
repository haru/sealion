"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  CircularProgress,
  Box,
  Alert,
  InputAdornment,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslations } from "next-intl";

interface ExternalProject {
  externalId: string;
  displayName: string;
  isEnabled: boolean;
}

interface ProjectSelectorDialogProps {
  providerId: string | null;
  providerName: string;
  onClose: () => void;
}

export default function ProjectSelectorDialog({
  providerId,
  providerName,
  onClose,
}: ProjectSelectorDialogProps) {
  const t = useTranslations("providers");
  const tCommon = useTranslations("common");

  const [projects, setProjects] = useState<ExternalProject[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) return;

    setProjects([]);
    setFilter("");
    setError(null);
    setLoading(true);

    fetch(`/api/providers/${providerId}/projects`)
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.data)) {
          setProjects(json.data as ExternalProject[]);
        } else {
          setError(tCommon("error"));
        }
      })
      .catch(() => setError(tCommon("error")))
      .finally(() => setLoading(false));
  }, [providerId, tCommon]);

  function toggleProject(externalId: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.externalId === externalId ? { ...p, isEnabled: !p.isEnabled } : p
      )
    );
  }

  async function handleSave() {
    if (!providerId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/providers/${providerId}/projects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects }),
      });
      if (!res.ok) throw new Error();
      onClose();
    } catch {
      setError(tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!providerId} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t("projects.title")} — {providerName}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>{t("projects.subtitle")}</DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={32} />
          </Box>
        ) : projects.length === 0 ? (
          <DialogContentText>{t("projects.noProjects")}</DialogContentText>
        ) : (
          <>
            <TextField
              size="small"
              fullWidth
              placeholder={t("projects.search")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ mb: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          <List disablePadding>
            {projects.filter((p) =>
              p.displayName.toLowerCase().includes(filter.toLowerCase())
            ).map((project) => (
              <ListItem
                key={project.externalId}
                disableGutters
                onClick={() => toggleProject(project.externalId)}
                sx={{ cursor: "pointer" }}
              >
                <Checkbox
                  checked={project.isEnabled}
                  tabIndex={-1}
                  readOnly
                />
                <ListItemText primary={project.displayName} />
              </ListItem>
            ))}
          </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {tCommon("cancel")}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || saving}
        >
          {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          {tCommon("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
