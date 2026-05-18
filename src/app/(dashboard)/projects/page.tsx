"use client";

import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { Box, Button } from "@mui/material";
import { useTranslations } from "next-intl";
import { useState } from "react";

import AddProjectDialog from "@/components/projects/AddProjectDialog";
import ProjectList from "@/components/projects/ProjectList";
import PageContent from "@/components/ui/PageContent";
import { usePageHeader } from "@/hooks/usePageHeader";

/** Projects management page for registering and removing external projects. */
export default function ProjectsPage() {
  const t = useTranslations("projects");
  usePageHeader(t("title"), undefined, FolderOpenIcon);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);

  /** Opens the add-project dialog with a fresh key so its state resets. */
  function handleDialogOpen() {
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  /** Handles dialog close and triggers a list refresh if a project was saved. */
  function handleDialogClose(saved: boolean) {
    setDialogOpen(false);
    if (saved) { setRefreshSignal((n) => n + 1); }
  }

  return (
    <PageContent maxWidth="md">
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleDialogOpen}
        >
          {t("addProject")}
        </Button>
      </Box>

      <ProjectList refreshSignal={refreshSignal} />

      <AddProjectDialog key={dialogKey} open={dialogOpen} onClose={handleDialogClose} />
    </PageContent>
  );
}
