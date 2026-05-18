"use client";

import BoardSettingsForm from "@/components/board-settings/BoardSettingsForm";
import PageContent from "@/components/ui/PageContent";
import { usePageMeta } from "@/hooks/usePageMeta";

/** Board settings page — controls display items and sort order for the issue list. */
export default function BoardSettingsPage() {
  usePageMeta();

  return (
    <PageContent maxWidth="md">
      <BoardSettingsForm />
    </PageContent>
  );
}
