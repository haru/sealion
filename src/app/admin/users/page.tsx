"use client";

import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PeopleIcon from "@mui/icons-material/People";
import {
  Container,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Stack,
  IconButton,
  Tooltip,
} from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useMemo } from "react";

import { useAdminUserId } from "@/app/admin/AdminSessionProvider";
import { useMessageQueue } from "@/components/MessageQueue";
import DataTable from "@/components/ui/DataTable";
import { usePageHeader } from "@/hooks/usePageHeader";

import CreateUserDialog from "./CreateUserDialog";
import EditUserDialog from "./EditUserDialog";

/** A user record as returned by GET /api/admin/users. */
interface User {
  id: string;
  email: string;
  username: string | null;
  role: "USER" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

/** Maps user status values to MUI Chip color props. */
const STATUS_CHIP_PROPS: Record<string, { color: "warning" | "success" | "error" }> = {
  PENDING: { color: "warning" },
  ACTIVE: { color: "success" },
  SUSPENDED: { color: "error" },
};

/** Admin page for managing user accounts (list, create, edit, delete). */
export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tSidebar = useTranslations("sidebar");
  const currentUserId = useAdminUserId();
  const { addMessage } = useMessageQueue();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  usePageHeader(t("userManagement"), undefined, PeopleIcon, undefined, tSidebar("systemAdmin"), AdminPanelSettingsIcon);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data);
      } else {
        addMessage("error", tCommon("error"));
      }
    } catch {
      addMessage("error", tCommon("error"));
    }
    setLoading(false);
  }, [addMessage, tCommon]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  /**
   * Translates an API error code into a user-facing string.
   * Falls back to the generic error message when the code has no translation.
   *
   * @param code - The error code string returned by the API, or undefined.
   * @returns A localised error message.
   */
  function translateError(code: string | undefined): string {
    if (!code) {
      return tCommon("error");
    }
    try {
      return tErrors(code as Parameters<typeof tErrors>[0]);
    } catch {
      return tCommon("error");
    }
  }

  /** Executes the cascade delete for the current deleteTarget. */
  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const contentType = res.headers.get("content-type") ?? "";
      let json: unknown = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (res.ok) {
        addMessage("information", t("deleteSuccess"));
        setDeleteTarget(null);
        await fetchUsers();
      } else {
        const code =
          json != null &&
          typeof json === "object" &&
          "error" in json &&
          typeof (json as { error?: unknown }).error === "string"
            ? (json as { error: string }).error
            : undefined;
        addMessage("error", translateError(code));
        setDeleteTarget(null);
      }
    } catch {
      addMessage("error", tCommon("error"));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: "email",
        headerName: t("columns.email"),
        flex: 2,
        minWidth: 200,
      },
      {
        field: "username",
        headerName: t("columns.username"),
        flex: 1,
        minWidth: 150,
        renderCell: (params: GridRenderCellParams<User>) => params.row.username ?? "—",
      },
      {
        field: "role",
        headerName: t("columns.role"),
        width: 130,
        renderCell: (params: GridRenderCellParams<User>) => (
          <Chip
            label={t(`role.${params.row.role}`)}
            color={params.row.role === "ADMIN" ? "primary" : "default"}
            size="small"
          />
        ),
      },
      {
        field: "status",
        headerName: t("columns.status"),
        width: 130,
        renderCell: (params: GridRenderCellParams<User>) => {
          const chipProps = STATUS_CHIP_PROPS[params.row.status] ?? { color: "default" as const };
          return (
            <Chip
              label={t(`status.${params.row.status}`)}
              color={chipProps.color}
              size="small"
            />
          );
        },
      },
      {
        field: "createdAt",
        headerName: t("columns.createdAt"),
        flex: 1,
        minWidth: 130,
        renderCell: (params: GridRenderCellParams<User>) =>
          new Date(params.row.createdAt).toLocaleDateString(),
      },
      {
        field: "actions",
        headerName: "",
        width: 100,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (params: GridRenderCellParams<User>) => {
          const user = params.row;
          const isSelf = user.id === currentUserId;
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={t("editUser")}>
                <IconButton
                  size="small"
                  aria-label={t("editUser")}
                  onClick={() => setEditTarget(user)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={isSelf ? t("cannotDeleteSelf") : t("deleteUser")}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t("deleteUser")}
                    onClick={() => setDeleteTarget(user)}
                    disabled={isSelf}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [t, currentUserId],
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="flex-end" mb={3}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {t("createUser")}
        </Button>
      </Stack>

      <DataTable columns={columns} rows={users} loading={loading} />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          addMessage("information", t("createSuccess"));
          await fetchUsers();
        }}
      />

      <EditUserDialog
        user={editTarget}
        isSelf={editTarget?.id === currentUserId}
        onClose={() => setEditTarget(null)}
        onSaved={fetchUsers}
      />

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("deleteUser")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("confirmDelete")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{tCommon("cancel")}</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={deleting}>
            {tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
