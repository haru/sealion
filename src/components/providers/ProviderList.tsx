"use client";

import { useState } from "react";
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Typography,
  Box,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import GitHubIcon from "@mui/icons-material/GitHub";
import CloudIcon from "@mui/icons-material/Cloud";
import { useTranslations } from "next-intl";
import ProviderEditModal from "./ProviderEditModal";

interface Provider {
  id: string;
  type: "GITHUB" | "JIRA" | "REDMINE";
  displayName: string;
  baseUrl: string | null;
}

interface ProviderListProps {
  providers: Provider[];
  onDelete: (id: string) => void;
  onUpdated: (updated: Provider) => void;
}

function ProviderIcon({ type }: { type: Provider["type"] }) {
  if (type === "GITHUB") return <GitHubIcon />;
  return <CloudIcon />;
}

export default function ProviderList({ providers, onDelete, onUpdated }: ProviderListProps) {
  const t = useTranslations("providers");
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  if (providers.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        {t("noProviders")}
      </Typography>
    );
  }

  return (
    <>
      <List>
        {providers.map((provider) => (
          <ListItem key={provider.id} divider>
            <Box sx={{ mr: 2, display: "flex", alignItems: "center" }}>
              <ProviderIcon type={provider.type} />
            </Box>
            <ListItemText
              primary={provider.displayName}
              secondary={
                <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
                  <Chip
                    component="span"
                    label={t(`type.${provider.type}`)}
                    size="small"
                    variant="outlined"
                  />
                  {provider.baseUrl && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {provider.baseUrl}
                    </Typography>
                  )}
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <Tooltip title={t("editProvider")}>
                <IconButton
                  aria-label="edit"
                  onClick={() => setEditingProvider(provider)}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("deleteProvider")}>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => onDelete(provider.id)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      {editingProvider && (
        <ProviderEditModal
          provider={editingProvider}
          open={true}
          onClose={() => setEditingProvider(null)}
          onUpdated={(updated) => {
            onUpdated(updated);
            setEditingProvider(null);
          }}
        />
      )}
    </>
  );
}
