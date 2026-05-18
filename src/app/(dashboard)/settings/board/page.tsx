"use client";

import TuneIcon from "@mui/icons-material/Tune";
import { useTranslations } from "next-intl";

import BoardSettingsForm from "@/components/board-settings/BoardSettingsForm";
import PageContent from "@/components/ui/PageContent";
import { usePageHeader } from "@/hooks/usePageHeader";

/** Board settings page — controls display items and sort order for the issue list. */
export default function BoardSettingsPage() {
  const t = useTranslations("boardSettings");
  usePageHeader(t("title"), undefined, TuneIcon);

  return (
    <PageContent maxWidth="md">
      <BoardSettingsForm />
    </PageContent>
  );
}
