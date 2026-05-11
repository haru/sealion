"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EmailIcon from "@mui/icons-material/Email";
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

import { useMessageQueue } from "@/components/MessageQueue";
import { usePageHeader } from "@/hooks/usePageHeader";
import { SMTP_DUMMY_PASSWORD } from "@/lib/email/smtp-constants";

/** Shape of the data returned by GET /api/admin/smtp-settings. */
interface SmtpSettingsData {
  host: string;
  port: number;
  fromAddress: string;
  fromName: string;
  requireAuth: boolean;
  username: string | null;
  hasPassword: boolean;
  useTls: boolean;
}

/** SMTP settings admin page — allows admin to configure and test SMTP server connection. */
export default function SmtpSettingsPage() {
  const t = useTranslations("smtpSettings");
  const tSidebar = useTranslations("sidebar");
  const { addMessage } = useMessageQueue();

  usePageHeader(t("title"), undefined, EmailIcon, undefined, tSidebar("systemAdmin"), AdminPanelSettingsIcon);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("Sealion");
  const [requireAuth, setRequireAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useTls, setUseTls] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/admin/smtp-settings");

        if (!res.ok) {
          addMessage("error", t("saveError"));
          return;
        }

        const json = (await res.json()) as { data: SmtpSettingsData | null; error: string | null };

        if (!json.data) { return; }

        const s = json.data;
        setHost(s.host);
        setPort(s.port);
        setFromAddress(s.fromAddress);
        setFromName(s.fromName);
        setRequireAuth(s.requireAuth);
        setUsername(s.username ?? "");
        setPassword(s.hasPassword ? SMTP_DUMMY_PASSWORD : "");
        setUseTls(s.useTls);
      } catch {
        addMessage("error", t("saveError"));
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [addMessage, t]);

  /** Builds the request body from current form state. */
  function buildPayload() {
    return {
      host,
      port: Number(port),
      fromAddress,
      fromName,
      requireAuth,
      username: requireAuth ? username || null : null,
      password: requireAuth ? (password || null) : null,
      useTls,
    };
  }

  /** Saves the current form state to the API. */
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/smtp-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (res.ok) {
        const json = (await res.json()) as { data: SmtpSettingsData };
        const s = json.data;
        setPassword(s.hasPassword ? SMTP_DUMMY_PASSWORD : "");
        addMessage("information", t("saveSuccess"));
      } else {
        addMessage("error", t("saveError"));
      }
    } catch {
      addMessage("error", t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  /** Sends a test email using the current form values. */
  async function handleTestSend() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/smtp-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (res.ok) {
        addMessage("information", t("testSendSuccess"));
      } else {
        const json = (await res.json()) as { error: string | null };
        const message = json.error ?? t("unknownError");
        addMessage("error", t("testSendError", { message }));
      }
    } catch {
      addMessage("error", t("testSendError", { message: t("networkError") }));
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isBusy = saving || testing;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>

          <TextField
            label={t("host")}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label={t("port")}
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            required
            fullWidth
            slotProps={{ htmlInput: { min: 1, max: 65535 } }}
          />

          <TextField
            label={t("fromAddress")}
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label={t("fromName")}
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            required
            fullWidth
          />

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={useTls}
                onChange={(e) => setUseTls(e.target.checked)}
                slotProps={{ input: { "aria-label": t("useTls") } }}
              />
            }
            label={<Typography sx={{ fontWeight: 500 }}>{t("useTls")}</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={requireAuth}
                onChange={(e) => setRequireAuth(e.target.checked)}
                slotProps={{ input: { "aria-label": t("requireAuth") } }}
              />
            }
            label={<Typography sx={{ fontWeight: 500 }}>{t("requireAuth")}</Typography>}
          />

          <Collapse in={requireAuth} unmountOnExit>
            <Stack spacing={3}>
              <TextField
                label={t("username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
              />
              <TextField
                label={t("password")}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />
            </Stack>
          </Collapse>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isBusy}
            >
              {t("save")}
            </Button>

            <Button
              variant="outlined"
              onClick={handleTestSend}
              disabled={isBusy}
            >
              {t("testSend")}
            </Button>
          </Stack>

        </Stack>
      </Paper>
    </Container>
  );
}
