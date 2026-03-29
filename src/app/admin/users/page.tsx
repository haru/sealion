"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Switch,
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
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useMessageQueue } from "@/components/MessageQueue";
import EditUserDialog from "./EditUserDialog";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

/** A user record as returned by GET /api/admin/users. */
interface User {
  id: string;
  email: string;
  username: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
}

/** Admin page for managing user accounts (list, create, edit, delete). */
export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { data: session } = useSession();
  const { addMessage } = useMessageQueue();

  const [users, setUsers] = useState<User[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Create dialog state ---
  const [createOpen, setCreateOpen] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUsers();
  }, [fetchUsers]);

  /** Toggles the active status of a user. */
  async function handleToggleActive(user: User) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    const json = await res.json();
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)));
    } else {
      addMessage("error", json.error ?? tCommon("error"));
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
      setFormError(json.error ?? tCommon("error"));
    }
    setCreating(false);
  }

  /** Executes the cascade delete for the current deleteTarget. */
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);

    const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();

    if (res.ok) {
      addMessage("information", t("deleteSuccess"));
      setDeleteTarget(null);
      await fetchUsers();
    } else {
      addMessage("error", json.error ?? tCommon("error"));
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  const currentUserId = session?.user?.id;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {t("userManagement")}
        </Typography>
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
                    <Switch
                      checked={user.isActive}
                      onChange={() => handleToggleActive(user)}
                      aria-label={user.isActive ? t("disableUser") : t("enableUser")}
                      disabled={isSelf}
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
