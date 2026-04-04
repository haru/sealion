"use client";

import TuneIcon from "@mui/icons-material/Tune";
import { Container } from "@mui/material";
import { useTranslations } from "next-intl";

import BoardSettingsForm from "@/components/board-settings/BoardSettingsForm";
import { usePageHeader } from "@/hooks/usePageHeader";

/** Board settings page — controls display items and sort order for the issue list. */
export default function BoardSettingsPage() {
  const t = useTranslations("boardSettings");
  usePageHeader(t("title"), undefined, TuneIcon);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <BoardSettingsForm />
    </Container>
  );
}
