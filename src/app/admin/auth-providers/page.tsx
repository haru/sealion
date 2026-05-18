/**
 * Admin page — IdP list + add/edit dialog hosting {@link AuthProviderForm}.
 * Lists every configured `AuthProvider` (enabled + disabled) with their
 * linked-account counts. Supports inline edit and delete with confirmation.
 */

"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ProviderIcon } from "@/components/auth/ProviderIcon";
import { useMessageQueue } from "@/components/MessageQueue";
import type { AuthProviderType } from "@/services/auth-provider/types";

import type { AuthProviderInitialValues } from "./_components/AuthProviderForm";
import { AuthProviderForm } from "./_components/AuthProviderForm";

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
 * Renders the admin Auth Providers page.
 *
 * @returns The page element.
 */
export default function AdminAuthProvidersPage() {
  const t = useTranslations("authProviders.admin");
  const { addMessage } = useMessageQueue();
  const [rows, setRows] = useState<AdminAuthProviderRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AuthProviderInitialValues | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AdminAuthProviderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" component="h1">{t("title")}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          {t("addButton")}
        </Button>
      </Box>

      {error && (
        <Paper sx={{ p: 2, bgcolor: "error.light", color: "error.contrastText" }}>
          <Typography variant="body2">{error}</Typography>
        </Paper>
      )}

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="none" sx={{ width: 48 }}><span className="sr-only">Icon</span></TableCell>
              <TableCell>{t("table.displayName")}</TableCell>
              <TableCell>{t("table.providerId")}</TableCell>
              <TableCell>{t("table.type")}</TableCell>
              <TableCell>{t("table.enabled")}</TableCell>
              <TableCell align="right">{t("table.linkedAccountCount")}</TableCell>
              <TableCell padding="none" sx={{ width: 96 }} align="center"><span className="sr-only">Actions</span></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {t("table.empty")}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><ProviderIcon type={r.type} /></TableCell>
                <TableCell>{r.displayName}</TableCell>
                <TableCell><code>{r.providerId}</code></TableCell>
                <TableCell>{t(`types.${r.type}`)}</TableCell>
                <TableCell>
                  {r.enabled
                    ? <Chip size="small" color="success" label={t("table.on")} />
                    : <Chip size="small" label={t("table.off")} />}
                </TableCell>
                <TableCell align="right">{r.linkedAccountCount}</TableCell>
                <TableCell padding="none" align="center">
                  <Tooltip title={t("editButton")}>
                    <IconButton size="small" onClick={() => handleEdit(r)} aria-label={t("editButton")}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t("deleteButton")}>
                    <IconButton size="small" onClick={() => setDeleteTarget(r)} aria-label={t("deleteButton")}>
                      <DeleteOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{editTarget ? t("editButton") : t("addButton")}</DialogTitle>
        <DialogContent>
          <AuthProviderForm
            initialValues={editTarget}
            onCreated={() => { handleClose(); void fetchRows(); }}
            onUpdated={() => { handleClose(); void fetchRows(); }}
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
            {t("deleteConfirmCancel")}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleting}>
            {t("deleteConfirmOk")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
