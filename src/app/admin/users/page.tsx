"use client";

import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PeopleIcon from "@mui/icons-material/People";
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  Stack,
  IconButton,
  Tooltip,
} from "@mui/material";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";

import { useAdminUserId } from "@/app/admin/AdminSessionProvider";
import { useMessageQueue } from "@/components/MessageQueue";
import { usePageHeader } from "@/hooks/usePageHeader";

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
  const [formError, setFormError] = useState<string | null>(null);

  // --- Create dialog state ---
  const [createOpen, setCreateOpen] = useState(false);

  usePageHeader(t("userManagement"), undefined, PeopleIcon, undefined, tSidebar("systemAdmin"), AdminPanelSettingsIcon);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [creating, setCreating] = useState(false);

  // --- Edit dialog state ---
  const [editTarget, setEditTarget] = useState<User | null>(null);

  // --- Delete dialog state ---
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const json = await res.json();
      setUsers(json.data);
    }
  }, []);

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
    if (!code) { return tCommon("error"); }
    try {
      return tErrors(code as Parameters<typeof tErrors>[0]);
    } catch {
      return tCommon("error");
    }
  }

  /** Submits the create-user form and refreshes the user list on success. */
  async function handleCreateUser() {
    setCreating(true);
    setFormError(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole, username: newUsername.trim() }),
    });

    const json = await res.json();
    if (res.ok) {
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewUsername("");
      setNewRole("USER");
      addMessage("information", t("createSuccess"));
      await fetchUsers();
    } else {
      setFormError(translateError(json?.error as string | undefined));
    }
    setCreating(false);
  }

  /** Executes the cascade delete for the current deleteTarget. */
  async function handleDeleteConfirm() {
    if (!deleteTarget) { return; }
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="flex-end" mb={3}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          {t("createUser")}
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("columns.email")}</TableCell>
              <TableCell>{t("columns.username")}</TableCell>
              <TableCell>{t("columns.role")}</TableCell>
              <TableCell>{t("columns.status")}</TableCell>
              <TableCell>{t("columns.createdAt")}</TableCell>
              <TableCell>{t("columns.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const chipProps = STATUS_CHIP_PROPS[user.status] ?? { color: "default" as const };
              return (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.username ?? "—"}</TableCell>
                  <TableCell>
                    <Chip
                      label={t(`role.${user.role}`)}
                      color={user.role === "ADMIN" ? "primary" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`status.${user.status}`)}
                      color={chipProps.color}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("createUser")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && (
              <Alert severity="error" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
            )}
            <TextField
              label={t("fields.email")}
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label={t("fields.username")}
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label={t("fields.password")}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>{t("fields.role")}</InputLabel>
              <Select
                value={newRole}
                label={t("fields.role")}
                onChange={(e) => setNewRole(e.target.value as "USER" | "ADMIN")}
              >
                <MenuItem value="USER">{t("role.USER")}</MenuItem>
                <MenuItem value="ADMIN">{t("role.ADMIN")}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{tCommon("cancel")}</Button>
          <Button onClick={handleCreateUser} variant="contained" disabled={creating}>
            {t("createUser")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editTarget}
        isSelf={editTarget?.id === currentUserId}
        onClose={() => setEditTarget(null)}
        onSaved={fetchUsers}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
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
