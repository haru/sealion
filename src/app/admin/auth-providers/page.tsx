/**
 * Admin page — IdP list + "Add IdP" dialog hosting {@link AuthProviderForm}.
 * Lists every configured `AuthProvider` (enabled + disabled) with their
 * linked-account counts.
 */

"use client";

import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ProviderIcon } from "@/components/auth/ProviderIcon";
import type { AuthProviderType } from "@/services/auth-provider/types";

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
  const [rows, setRows] = useState<AdminAuthProviderRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Refreshes the table by calling the admin API. Used on mount and after a create. */
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

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" component="h1">{t("title")}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
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
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("addButton")}</DialogTitle>
        <DialogContent>
          <AuthProviderForm onCreated={() => { setOpen(false); void fetchRows(); }} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
