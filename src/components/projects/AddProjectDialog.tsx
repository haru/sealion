"use client";

import SearchIcon from "@mui/icons-material/Search";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Radio,
  Checkbox,
  CircularProgress,
  Box,
  Alert,
  TextField,
  InputAdornment,
  Typography,
  Chip,
} from "@mui/material";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

import ProviderIcon from "@/components/ProviderIcon";

interface Provider {
  id: string;
  type: "GITHUB" | "JIRA" | "REDMINE" | "GITLAB";
  displayName: string;
  iconUrl: string | null;
}

interface ExternalProject {
  externalId: string;
  displayName: string;
  isRegistered: boolean;
}

interface AddProjectDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
}


/** Multi-step dialog for selecting a provider and registering external projects. */
export default function AddProjectDialog({ open, onClose }: AddProjectDialogProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");

  const [step, setStep] = useState<"provider" | "projects">("provider");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [externalProjects, setExternalProjects] = useState<ExternalProject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { return; }
    setStep("provider");
    setSelectedProvider(null);
    setExternalProjects([]);
    setSelected(new Set());
    setFilter("");
    setError(null);

    setLoadingProviders(true);
    fetch("/api/providers")
      .then((res) => {
        if (!res.ok) { throw new Error(); }
        return res.json();
      })
      .then((json) => setProviders(json.data ?? []))
      .catch(() => setError(tCommon("error")))
      .finally(() => setLoadingProviders(false));
  }, [open, tCommon]);

  /** Selects the given provider and advances to the projects step. */
  function handleSelectProvider(provider: Provider) {
    setSelectedProvider(provider);
  }

  /** Loads external projects for the selected provider. */
  async function handleNextStep() {
    if (!selectedProvider) { return; }
    setStep("projects");
    setLoadingProjects(true);
    setError(null);
    try {
      const res = await fetch(`/api/providers/${selectedProvider.id}/projects`);
      if (!res.ok) { throw new Error(); }
      const json = await res.json();
      setExternalProjects(json.data ?? []);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoadingProjects(false);
    }
  }

  /** Toggles selection of a project by its external ID. */
  function toggleProject(externalId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) {
        next.delete(externalId);
      } else {
        next.add(externalId);
      }
      return next;
    });
  }

  /** Saves the selected projects via the API. */
  async function handleSave() {
    if (!selectedProvider || selected.size === 0) { return; }
    setSaving(true);
    setError(null);
    try {
      const toAdd = externalProjects.filter((p) => selected.has(p.externalId));
      const results = await Promise.all(
        toAdd.map((p) =>
          fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              issueProviderId: selectedProvider.id,
              externalId: p.externalId,
              displayName: p.displayName,
            }),
          })
        )
      );
      const failed = results.filter((res) => !res.ok);
      if (failed.length > 0) {
        const json = await failed[0].json().catch(() => ({}));
        setError(json?.error ? tErrors(json.error) : tCommon("error"));
        return;
      }
      onClose(true);
    } catch {
      setError(tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  const filteredProjects = externalProjects.filter((p) =>
    p.displayName.toLowerCase().includes(filter.toLowerCase())
  );

  let providerContent;
  if (loadingProviders) {
    providerContent = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={32} />
      </Box>
    );
  } else if (providers.length === 0) {
    providerContent = (
      <Box sx={{ py: 2 }}>
        <Typography color="text.secondary" gutterBottom>
          {t("noProviders")}
        </Typography>
        <Button component={Link} href="/settings/providers" variant="outlined" size="small">
          {t("goToProviders")}
        </Button>
      </Box>
    );
  } else {
    providerContent = (
      <List disablePadding>
        {providers.map((provider) => (
          <ListItemButton
            key={provider.id}
            onClick={() => handleSelectProvider(provider)}
            selected={selectedProvider?.id === provider.id}
          >
            <ListItemIcon>
              <Radio
                checked={selectedProvider?.id === provider.id}
                tabIndex={-1}
                readOnly
              />
            </ListItemIcon>
            <ListItemIcon>
              <ProviderIcon iconUrl={provider.iconUrl} label={provider.type} />
            </ListItemIcon>
            <ListItemText primary={provider.displayName} />
          </ListItemButton>
        ))}
      </List>
    );
  }

  let projectsContent;
  if (loadingProjects) {
    projectsContent = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={32} />
      </Box>
    );
  } else if (externalProjects.length === 0) {
    projectsContent = (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        {t("noProjects")}
      </Typography>
    );
  } else {
    projectsContent = (
      <>
        <TextField
          size="small"
          fullWidth
          placeholder={t("searchProjects")}
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
          {filteredProjects.map((project) => (
            <ListItemButton
              key={project.externalId}
              disableGutters
              disabled={project.isRegistered}
              onClick={() => !project.isRegistered && toggleProject(project.externalId)}
            >
              <Checkbox
                checked={project.isRegistered || selected.has(project.externalId)}
                disabled={project.isRegistered}
                tabIndex={-1}
                readOnly
              />
              <ListItemText primary={project.displayName} />
              {project.isRegistered && (
                <Chip label={t("alreadyRegistered")} size="small" sx={{ ml: 1 }} />
              )}
            </ListItemButton>
          ))}
        </List>
      </>
    );
  }

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm">
      <DialogTitle>
        {step === "provider" ? t("selectProvider") : selectedProvider?.displayName ?? ""}
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {step === "provider" && (
          <>
            <DialogContentText sx={{ mb: 1 }}>{t("selectProviderSubtitle")}</DialogContentText>
            {providerContent}
          </>
        )}

        {step === "projects" && projectsContent}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={saving}>
          {tCommon("cancel")}
        </Button>
        {step === "provider" && (
          <Button
            onClick={handleNextStep}
            variant="contained"
            disabled={!selectedProvider || loadingProviders}
          >
            {tCommon("next")}
          </Button>
        )}
        {step === "projects" && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={selected.size === 0 || saving || loadingProjects}
          >
            {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            {t("add")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
