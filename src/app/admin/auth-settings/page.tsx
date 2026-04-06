"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SecurityIcon from "@mui/icons-material/Security";
import {
  Container,
  Paper,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  FormHelperText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Divider,
  CircularProgress,
  Box,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

import { useMessageQueue } from "@/components/MessageQueue";
import { usePageHeader } from "@/hooks/usePageHeader";

/** The valid sessionTimeoutMinutes option values with their i18n keys. */
const TIMEOUT_OPTIONS: Array<{ value: number | null; labelKey: string }> = [
  { value: null, labelKey: "none" },
  { value: 60, labelKey: "1h" },
  { value: 360, labelKey: "6h" },
  { value: 720, labelKey: "12h" },
  { value: 1440, labelKey: "24h" },
  { value: 10080, labelKey: "1w" },
  { value: 43200, labelKey: "30d" },
  { value: 129600, labelKey: "90d" },
];

/** Current persisted form values from the API. */
interface AuthSettingsData {
  allowUserSignup: boolean;
  sessionTimeoutMinutes: number | null;
  requireEmailVerification: boolean;
}

/** Auth settings admin page — allows ADMIN to configure signup and session timeout. */
export default function AuthSettingsPage() {
  const t = useTranslations("authSettings");
  const tSidebar = useTranslations("sidebar");
  const { addMessage } = useMessageQueue();

  usePageHeader(t("title"), undefined, SecurityIcon, undefined, tSidebar("systemAdmin"), AdminPanelSettingsIcon);

  const [saved, setSaved] = useState<AuthSettingsData | null>(null);
  const [allowUserSignup, setAllowUserSignup] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number | null>(null);
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/admin/auth-settings");

        if (!res.ok) {
          addMessage("error", t("saveError"));
          return;
        }

        const json = (await res.json()) as {
          data: AuthSettingsData | null;
          error: string | null;
        };

        if (!json.data) {
          addMessage("error", t("saveError"));
          return;
        }

        setSaved(json.data);
        setAllowUserSignup(json.data.allowUserSignup);
        setSessionTimeoutMinutes(json.data.sessionTimeoutMinutes);
        setRequireEmailVerification(json.data.requireEmailVerification);
      } catch {
        addMessage("error", t("saveError"));
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [addMessage, t]);

  /** Saves the current form state to the API. On failure, reverts to last saved values. */
  async function handleSave() {
    setSaving(true);

    try {
      const res = await fetch("/api/admin/auth-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowUserSignup, sessionTimeoutMinutes, requireEmailVerification }),
      });

      if (res.ok) {
        const json = (await res.json()) as { data: AuthSettingsData };
        setSaved(json.data);
        setAllowUserSignup(json.data.allowUserSignup);
        setSessionTimeoutMinutes(json.data.sessionTimeoutMinutes);
        setRequireEmailVerification(json.data.requireEmailVerification);
        addMessage("information", t("saveSuccess"));
      } else {
        if (saved) {
          setAllowUserSignup(saved.allowUserSignup);
          setSessionTimeoutMinutes(saved.sessionTimeoutMinutes);
          setRequireEmailVerification(saved.requireEmailVerification);
        }
        addMessage("error", t("saveError"));
      }
    } catch {
      if (saved) {
        setAllowUserSignup(saved.allowUserSignup);
        setSessionTimeoutMinutes(saved.sessionTimeoutMinutes);
        setRequireEmailVerification(saved.requireEmailVerification);
      }
      addMessage("error", t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" pt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={4}>

          {/* allowUserSignup */}
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={allowUserSignup}
                  onChange={(e) => {
                    setAllowUserSignup(e.target.checked);
                    if (!e.target.checked) { setRequireEmailVerification(false); }
                  }}
                  inputProps={{ "aria-label": t("allowUserSignup") }}
                />
              }
              label={<Typography fontWeight={500}>{t("allowUserSignup")}</Typography>}
            />
            <FormHelperText sx={{ ml: 0 }}>{t("allowUserSignupHint")}</FormHelperText>
          </Stack>

          {/* requireEmailVerification — only shown when allowUserSignup is true */}
          {allowUserSignup && (
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={requireEmailVerification}
                    onChange={(e) => setRequireEmailVerification(e.target.checked)}
                    inputProps={{ "aria-label": t("requireEmailVerification") }}
                  />
                }
                label={<Typography fontWeight={500}>{t("requireEmailVerification")}</Typography>}
              />
              <FormHelperText sx={{ ml: 0 }}>{t("requireEmailVerificationHint")}</FormHelperText>
            </Stack>
          )}

          <Divider />

          {/* sessionTimeoutMinutes */}
          <FormControl fullWidth>
            <InputLabel id="session-timeout-label">{t("sessionTimeout")}</InputLabel>
            <Select
              labelId="session-timeout-label"
              label={t("sessionTimeout")}
              value={sessionTimeoutMinutes === null ? "null" : String(sessionTimeoutMinutes)}
              onChange={(e) => {
                const raw = e.target.value;
                setSessionTimeoutMinutes(raw === "null" ? null : Number(raw));
              }}
            >
              {TIMEOUT_OPTIONS.map((opt) => (
                <MenuItem key={String(opt.value)} value={opt.value === null ? "null" : String(opt.value)}>
                  {t(`timeout.${opt.labelKey}` as Parameters<typeof t>[0])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ alignSelf: "flex-start" }}
          >
            {t("save")}
          </Button>

        </Stack>
      </Paper>
    </Container>
  );
}
