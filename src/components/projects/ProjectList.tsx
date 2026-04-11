"use client";

import DeleteIcon from "@mui/icons-material/Delete";
import {
  IconButton,
  Chip,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
  Switch,
  CircularProgress,
} from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useMemo } from "react";

import ProviderIcon from "@/components/ProviderIcon";
import DataTable from "@/components/ui/DataTable";

interface IssueProvider {
  id: string;
  displayName: string;
  type: string;
  iconUrl: string | null;
}

interface Project {
  id: string;
  externalId: string;
  displayName: string;
  includeUnassigned: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  issueProvider: IssueProvider;
}

interface ProjectListProps {
  /** Incrementing this value triggers a re-fetch of the project list. */
  refreshSignal?: number;
}

/** Fetches and displays the list of registered projects with delete and unassigned-toggle actions. */
export default function ProjectList({ refreshSignal }: ProjectListProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error();
      }
      const json = await res.json();
      setProjects(json.data);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects, refreshSignal]);

  const handleToggleUnassigned = useCallback(
    async (projectId: string, currentValue: boolean) => {
      setTogglingId(projectId);
      const next = !currentValue;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, includeUnassigned: next } : p,
        ),
      );
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeUnassigned: next }),
        });
        if (!res.ok) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId ? { ...p, includeUnassigned: currentValue } : p,
            ),
          );
          setError(tCommon("error"));
        }
      } catch {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, includeUnassigned: currentValue } : p,
          ),
        );
        setError(tCommon("error"));
      } finally {
        setTogglingId(null);
      }
    },
    [tCommon],
  );

  /** Sends the delete request for the currently pending deletion target. */
  async function handleDeleteConfirm() {
    if (!deleteId) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteId));
      } else {
        setError(tCommon("error"));
      }
    } catch {
      setError(tCommon("error"));
    } finally {
      setDeleteId(null);
    }
  }

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: "displayName",
        headerName: t("projectName"),
        flex: 2,
        minWidth: 150,
      },
      {
        field: "issueProvider",
        headerName: t("provider"),
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Project>) => {
          const provider = params.row.issueProvider;
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <ProviderIcon
                iconUrl={provider.iconUrl}
                label={provider.type}
                fontSize="small"
              />
              <Chip label={provider.displayName} size="small" variant="outlined" />
            </Box>
          );
        },
      },
      {
        field: "includeUnassigned",
        headerName: t("includeUnassigned"),
        flex: 1,
        minWidth: 260,
        sortable: false,
        align: "center",
        headerAlign: "center",
        renderCell: (params: GridRenderCellParams<Project>) => {
          const project = params.row;
          const isToggling = togglingId === project.id;
          return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
              <Switch
                checked={project.includeUnassigned}
                onChange={() =>
                  handleToggleUnassigned(project.id, project.includeUnassigned)
                }
                disabled={isToggling}
                size="small"
                inputProps={{ "aria-label": t("includeUnassigned") }}
              />
              {isToggling && <CircularProgress size={14} />}
            </Box>
          );
        },
      },
      {
        field: "actions",
        headerName: "",
        width: 60,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (params: GridRenderCellParams<Project>) => (
          <Tooltip title={t("deleteProject")}>
            <IconButton
              size="small"
              color="error"
              aria-label="delete project"
              onClick={() => setDeleteId(params.row.id)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [t, togglingId, handleToggleUnassigned],
  );

  return (
    <>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable columns={columns} rows={projects} loading={loading} />

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
    </>
  );
}
