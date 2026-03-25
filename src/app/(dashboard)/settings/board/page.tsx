"use client";

import { Container, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import BoardSettingsForm from "@/components/board-settings/BoardSettingsForm";

/** Board settings page — controls display items and sort order for the issue list. */
export default function BoardSettingsPage() {
  const t = useTranslations("boardSettings");

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        {t("title")}
      </Typography>
      <BoardSettingsForm />
    </Container>
  );
}
