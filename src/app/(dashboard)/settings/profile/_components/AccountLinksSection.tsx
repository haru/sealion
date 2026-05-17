"use client";

/**
 * Linked-IdP management section for the profile page. Lists the user's
 * linked external IdP accounts with an "Unlink" button each. Collocated under
 * the profile route (Principle VII) since only this page consumes it.
 */

import LinkOffIcon from "@mui/icons-material/LinkOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ProviderIcon } from "@/components/auth/ProviderIcon";

interface LinkedAccount {
  id: string;
  provider: string;
  type: string;
  displayName: string;
}

/**
 * Fetches the linked accounts for the authenticated user.
 *
 * @returns A promise resolving to the linked account list.
 */
async function fetchLinkedAccounts(): Promise<LinkedAccount[]> {
  const res = await fetch("/api/account/links");
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error ?? "UNKNOWN");
  }
  return body.data;
}

/**
 * Renders a list of linked external IdP accounts with unlink actions.
 *
 * @returns The section element.
 */
export function AccountLinksSection() {
  const t = useTranslations("accountLinks");

  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLinkedAccounts()
      .then((data) => {
        if (!cancelled) { setAccounts(data); }
      })
      .catch(() => {
        if (!cancelled) { setError("NETWORK"); }
      })
      .finally(() => {
        if (!cancelled) { setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const refresh = () => {
    setLoading(true);
    setError(null);
    fetchLinkedAccounts()
      .then((data) => { setAccounts(data); })
      .catch(() => { setError("NETWORK"); })
      .finally(() => { setLoading(false); });
  };

  const handleUnlink = async (provider: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/account/links/${provider}`, { method: "DELETE" });
      if (res.status === 204) {
        refresh();
        return;
      }
      const body = await res.json();
      setError(body.error ?? "UNKNOWN");
    } catch {
      setError("NETWORK");
    }
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        {t("title")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t(`errors.${error}`)}
        </Alert>
      )}

      {accounts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("noAccounts")}
        </Typography>
      ) : (
        <List dense>
          {accounts.map((account) => (
            <ListItem key={account.id} divider>
              <ListItemIcon>
                <ProviderIcon type={account.type as "GOOGLE" | "GITHUB" | "MICROSOFT_ENTRA" | "OIDC_GENERIC"} />
              </ListItemIcon>
              <ListItemText
                primary={account.displayName}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label={t("unlink")}
                  onClick={() => void handleUnlink(account.provider)}
                >
                  <LinkOffIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
