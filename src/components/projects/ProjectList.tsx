"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";
import ProviderIcon from "@/components/ProviderIcon";

interface IssueProvider {
  id: string;
  displayName: string;
  type: "GITHUB" | "JIRA" | "REDMINE";
  iconUrl: string | null;
}

interface Project {
  id: string;
  externalId: string;
  displayName: string;
  lastSyncedAt: string | null;
  syncError: string | null;
  issueProvider: IssueProvider;
}


interface ProjectListProps {
  refreshSignal?: number;
}

export default function ProjectList({ refreshSignal }: ProjectListProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error();
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

  async function handleDeleteConfirm() {
    if (!deleteId) return;
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (projects.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
        {t("noProjects")}
      </Typography>
    );
  }

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("projectName")}</TableCell>
              <TableCell>{t("provider")}</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>{project.displayName}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <ProviderIcon iconUrl={project.issueProvider.iconUrl} label={project.issueProvider.type} fontSize="small" />
                    <Chip
                      label={project.issueProvider.displayName}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t("deleteProject")}>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="delete project"
                      onClick={() => setDeleteId(project.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
