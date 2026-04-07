"use client";

import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import InboxIcon from "@mui/icons-material/Inbox";
import { Box, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import IssueCard from "@/components/IssueCard";
import TaskSearchBar from "@/components/search/TaskSearchBar";
import TodayTasksArea from "@/components/today-tasks/TodayTasksArea";
import CompleteIssueModal from "@/components/todo/CompleteIssueModal";
import SyncStatus from "@/components/todo/SyncStatus";
import SyncStatusChip from "@/components/todo/SyncStatusChip";
import TodoList from "@/components/todo/TodoList";
import { useDashboardDnD } from "@/hooks/useDashboardDnD";
import { useIssueData } from "@/hooks/useIssueData";
import { useMessageQueue } from "@/hooks/useMessageQueue";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useSyncPolling, type SyncProvider } from "@/hooks/useSyncPolling";
import { useTaskSearch } from "@/hooks/useTaskSearch";
import { useTodayTaskHandlers } from "@/hooks/useTodayTaskHandlers";
import { DEFAULT_BOARD_SETTINGS, type BoardSettings, type SortCriterion } from "@/lib/types";

/** Main dashboard page showing today's tasks and the full issue list with drag-and-drop support. */
export default function DashboardPage() {
  const t = useTranslations("todo");
  const tToday = useTranslations("todayTasks");
  const tBoardSettings = useTranslations("boardSettings");
  const { addMessage } = useMessageQueue();
  const { rawQuery, debouncedQuery, setRawQuery, clearSearch } = useTaskSearch();
  const sensors = useSensors(useSensor(PointerSensor));

  const [boardSettings, setBoardSettings] = useState<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  const boardSettingsSortOrderRef = useRef<SortCriterion[]>(DEFAULT_BOARD_SETTINGS.sortOrder);

  const {
    issues, todayIssues, total, page, loading,
    setIssues, setTodayIssues, setLoading, setPage,
    fetchIssues, fetchTodayIssues, handlePageChange,
  } = useIssueData({ debouncedQuery, boardSettingsSortOrderRef });

  const todayIssuesSorted = useMemo(
    () => todayIssues.map((i) => ({ ...i, todayOrder: i.todayOrder ?? 0 })).sort((a, b) => a.todayOrder - b.todayOrder),
    [todayIssues],
  );

  const {
    completeModalIssueId, handleModalCancel, handleModalConfirm,
    handleComplete, handleAddToToday, handleRemoveFromToday,
    handleReorder, handleTogglePin,
  } = useTodayTaskHandlers({
    issues, todayIssues, setIssues, setTodayIssues,
    boardSettingsSortOrderRef, addMessage, page,
    fetchIssues, t, tToday,
  });

  const {
    activeIssue, isDraggingOutside,
    handleDragStart, handleDragMove, handleDragCancel, handleDragEnd,
  } = useDashboardDnD({
    issues, todayIssuesSorted,
    handleAddToToday, handleRemoveFromToday, handleReorder,
  });

  const {
    isSyncing, syncProviders, handleSyncNow,
    setSyncProviders, maybeAutoSync,
  } = useSyncPolling(
    async () => { await Promise.all([fetchIssues(page), fetchTodayIssues()]); },
    addMessage,
    t("syncError"),
  );

  const availableProviderTypes = useMemo(
    () => [...new Set(syncProviders.map((p) => p.type))],
    [syncProviders],
  );
  const availableProjectNames = useMemo(
    () => [...new Set(syncProviders.flatMap((p) => p.projects.map((proj) => proj.displayName)))],
    [syncProviders],
  );

  const syncStatusActions = useMemo(
    () => <SyncStatus providers={syncProviders} isSyncing={isSyncing} onSyncNow={handleSyncNow} />,
    [syncProviders, isSyncing, handleSyncNow],
  );
  const syncTitleAddon = useMemo(
    () => <SyncStatusChip providers={syncProviders} isSyncing={isSyncing} />,
    [syncProviders, isSyncing],
  );

  usePageHeader(t("title"), syncStatusActions, FormatListBulletedIcon, syncTitleAddon);

  // Re-fetch issues whenever the debounced search/filter query changes.
  // Skip on initial mount (loading === true) — the init() call handles the first fetch.
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    void fetchIssues(1);
    setPage(1);
  }, [debouncedQuery, fetchIssues, setPage]);

  useEffect(() => {
    /** Loads initial issue data and triggers a background sync unless throttled. */
    async function init() {
      setLoading(true);
      let fetchedProviders: SyncProvider[] = [];
      let initialSortOrder: SortCriterion[] = DEFAULT_BOARD_SETTINGS.sortOrder;

      try {
        const bsRes = await fetch("/api/board-settings");
        if (!bsRes.ok) {
          addMessage("error", tBoardSettings("loadError"));
        } else {
          const bsJson = await bsRes.json();
          if (bsJson.error) {
            addMessage("error", tBoardSettings("loadError"));
          } else if (bsJson.data) {
            const bs = bsJson.data as BoardSettings;
            setBoardSettings(bs);
            boardSettingsSortOrderRef.current = bs.sortOrder;
            initialSortOrder = bs.sortOrder;
          }
        }
      } catch {
        addMessage("error", tBoardSettings("loadError"));
      }

      try {
        await Promise.all([
          fetchIssues(1, initialSortOrder),
          fetchTodayIssues(),
          fetch("/api/sync").then(async (res) => {
            if (res.ok) {
              fetchedProviders = (await res.json()).data;
              setSyncProviders(fetchedProviders);
            }
          }),
        ]);
      } catch {
        // Individual fetch errors are handled inside each callback;
        // this guards against unexpected rejections from Promise.all itself.
      }

      setLoading(false);
      maybeAutoSync(fetchedProviders);
    }
    void init();
  }, [fetchIssues, fetchTodayIssues, setLoading, tBoardSettings, addMessage, setSyncProviders, maybeAutoSync]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <Box sx={{ maxWidth: 896, mx: "auto", py: 5, px: 3, width: "100%" }}>
        <TodayTasksArea items={todayIssuesSorted} showCreatedAt={boardSettings.showCreatedAt} showUpdatedAt={boardSettings.showUpdatedAt} onRemove={handleRemoveFromToday} onComplete={handleComplete} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, px: 0.5 }}>
          <Box
            sx={{
              p: 1,
              bgcolor: "#f1f5f9",
              borderRadius: "8px",
              color: "text.secondary",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <InboxIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: "text.primary", letterSpacing: "-0.01em" }}>
              {t("backlog")}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <TaskSearchBar
            value={rawQuery}
            onSearch={setRawQuery}
            onClear={clearSearch}
            availableProviders={availableProviderTypes}
            availableProjects={availableProjectNames}
            hasNoResults={!loading && total === 0 && rawQuery.trim().length > 0}
          />
        </Box>
        <TodoList
          items={issues}
          total={total}
          page={page}
          limit={20}
          loading={loading}
          showCreatedAt={boardSettings.showCreatedAt}
          showUpdatedAt={boardSettings.showUpdatedAt}
          onPageChange={handlePageChange}
          onComplete={handleComplete}
          onAddToToday={handleAddToToday}
          onTogglePin={handleTogglePin}
        />
      </Box>

      <DragOverlay>
        {activeIssue ? (
          <Box
            sx={{
              cursor: "grabbing",
              boxShadow: 6,
              borderRadius: 1,
              ...(isDraggingOutside ? { filter: "grayscale(80%)", opacity: 0.6 } : { opacity: 0.95 }),
            }}
          >
            <IssueCard
              id={activeIssue.id}
              externalId={activeIssue.externalId}
              title={activeIssue.title}
              dueDate={activeIssue.dueDate}
              externalUrl={activeIssue.externalUrl}
              isUnassigned={activeIssue.isUnassigned}
              providerCreatedAt={activeIssue.providerCreatedAt}
              providerUpdatedAt={activeIssue.providerUpdatedAt}
              providerIconUrl={activeIssue.project.issueProvider.iconUrl}
              providerName={activeIssue.project.issueProvider.displayName}
              projectName={activeIssue.project.displayName}
              showCreatedAt={boardSettings.showCreatedAt}
              showUpdatedAt={boardSettings.showUpdatedAt}
              actionButton={null}
              dragContainerRef={undefined}
              dragHandleAttributes={undefined}
              dragHandleListeners={undefined}
            />
          </Box>
        ) : null}
      </DragOverlay>

      <CompleteIssueModal
        open={completeModalIssueId !== null}
        issueId={completeModalIssueId ?? ""}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </DndContext>
  );
}
