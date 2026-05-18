"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProviderIcon } from "@/components/auth/ProviderIcon";
import { useMessageQueue } from "@/components/MessageQueue";
import DataTable from "@/components/ui/DataTable";
import PageContent from "@/components/ui/PageContent";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { AuthProviderType } from "@/services/auth-provider/types";

import type { AuthProviderInitialValues } from "./_components/AuthProviderForm";
import { AuthProviderForm } from "./_components/AuthProviderForm";

/** A single auth-provider row as returned by the admin API. */
interface AdminAuthProviderRow {
  id: string;
  providerId: string;
  type: AuthProviderType;
  displayName: string;
  enabled: boolean;
  issuerUrl: string | null;
  clientId: string;
  scope: string | null;
  createdAt: string;
  updatedAt: string;
  linkedAccountCount: number;
}

/**
 * Admin page — IdP list + add/edit dialog hosting {@link AuthProviderForm}.
 * Lists every configured `AuthProvider` (enabled + disabled) with their
 * linked-account counts. Supports inline edit and delete with confirmation.
 */
export default function AdminAuthProvidersPage() {
  const t = useTranslations("authProviders.admin");
  const tCommon = useTranslations("common");
  const { addMessage } = useMessageQueue();

  usePageMeta();

  const [rows, setRows] = useState<AdminAuthProviderRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AuthProviderInitialValues | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AdminAuthProviderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo<GridColDef<AdminAuthProviderRow>[]>(
    () => [
      {
        field: "type",
        headerName: "",
        width: 48,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<AdminAuthProviderRow>) => (
          <ProviderIcon type={params.row.type} />
        ),
      },
      {
        field: "displayName",
        headerName: tCommon("displayName"),
        flex: 1,
        minWidth: 150,
      },
      {
        field: "providerId",
        headerName: t("table.providerId"),
        flex: 1,
        minWidth: 150,
        renderCell: (params: GridRenderCellParams<AdminAuthProviderRow>) => (
          <code>{params.row.providerId}</code>
        ),
      },
      {
        field: "typeLabel",
        headerName: t("table.type"),
        width: 160,
        renderCell: (params: GridRenderCellParams<AdminAuthProviderRow>) =>
          t(`types.${params.row.type}`),
      },
      {
        field: "enabled",
        headerName: t("table.enabled"),
        width: 110,
        renderCell: (params: GridRenderCellParams<AdminAuthProviderRow>) =>
          params.row.enabled
            ? <Chip size="small" color="success" label={t("table.on")} />
            : <Chip size="small" label={t("table.off")} />,
      },
      {
        field: "linkedAccountCount",
        headerName: t("table.linkedAccountCount"),
        width: 150,
        align: "right",
        headerAlign: "right",
      },
      {
        field: "actions",
        headerName: "",
        width: 96,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: (params: GridRenderCellParams<AdminAuthProviderRow>) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={tCommon("edit")}>
              <IconButton size="small" onClick={() => handleEdit(params.row)} aria-label={tCommon("edit")}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={tCommon("delete")}>
              <IconButton size="small" onClick={() => setDeleteTarget(params.row)} aria-label={tCommon("delete")}>
                <DeleteOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [t],
  );

  /** Refreshes the table by calling the admin API. */
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth-providers");
      const body = await res.json();
      if (!res.ok || body.error) {
        setError(t(`errors.${body.error ?? "UNKNOWN"}`));
        setRows([]);
        return;
      }
      setRows(body.data);
      setError(null);
    } catch {
      setError(t("errors.NETWORK"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching pattern: all setState calls are after await
    void fetchRows();
  }, [fetchRows]);

  /** Opens the create dialog. */
  function handleAdd() {
    setEditTarget(undefined);
    setOpen(true);
  }

  /** Opens the edit dialog pre-filled with the selected row. */
  function handleEdit(row: AdminAuthProviderRow) {
    setEditTarget({
      id: row.id,
      providerId: row.providerId,
      type: row.type as AuthProviderInitialValues["type"],
      displayName: row.displayName,
      enabled: row.enabled,
      issuerUrl: row.issuerUrl ?? "",
      clientId: row.clientId,
      scope: row.scope ?? "",
    });
    setOpen(true);
  }

  /** Closes the form dialog. */
  function handleClose() {
    setOpen(false);
    setEditTarget(undefined);
  }

  /** Confirms deletion of the selected provider. */
  async function handleDeleteConfirm() {
    if (!deleteTarget) { return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/auth-providers/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        addMessage("information", t("deleteSuccess"));
        setDeleteTarget(null);
        void fetchRows();
        return;
      }
      let code = "UNKNOWN";
      try {
        const body = await res.json();
        if (typeof body?.error === "string") { code = body.error; }
      } catch { /* keep UNKNOWN */ }
      addMessage("error", t(`form.errors.${code}`));
    } catch {
      addMessage("error", t("form.errors.UNKNOWN"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageContent maxWidth="lg">
      <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 3 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          {t("addButton")}
        </Button>
      </Stack>

      <DataTable columns={columns} rows={rows} loading={loading} />

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{editTarget ? tCommon("edit") : t("addButton")}</DialogTitle>
        <DialogContent dividers>
          <AuthProviderForm
            initialValues={editTarget}
            onCreated={() => { handleClose(); void fetchRows(); }}
            onUpdated={() => { handleClose(); void fetchRows(); }}
            onCancel={handleClose}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("deleteConfirmMessage", { name: deleteTarget?.displayName ?? "" })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleting}>
            {tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContent>
  );
}
