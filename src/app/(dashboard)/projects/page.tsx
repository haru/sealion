"use client";

import { useState } from "react";
import { Box, Button, Container, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslations } from "next-intl";
import ProjectList from "@/components/projects/ProjectList";
import AddProjectDialog from "@/components/projects/AddProjectDialog";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  function handleDialogClose(saved: boolean) {
    setDialogOpen(false);
    if (saved) setRefreshSignal((n) => n + 1);
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t("title")}
        </Typography>
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
