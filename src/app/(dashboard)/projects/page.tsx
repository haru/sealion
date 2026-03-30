"use client";

import { useState } from "react";
import { Box, Button, Container } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/hooks/usePageHeader";
import ProjectList from "@/components/projects/ProjectList";
import AddProjectDialog from "@/components/projects/AddProjectDialog";

/** Projects management page for registering and removing external projects. */
export default function ProjectsPage() {
  const t = useTranslations("projects");
  usePageHeader(t("title"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  /** Handles dialog close and triggers a list refresh if a project was saved. */
  function handleDialogClose(saved: boolean) {
    setDialogOpen(false);
    if (saved) setRefreshSignal((n) => n + 1);
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          {t("addProject")}
        </Button>
      </Box>

      <ProjectList refreshSignal={refreshSignal} />

      <AddProjectDialog open={dialogOpen} onClose={handleDialogClose} />
    </Container>
  );
}
