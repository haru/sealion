"use client";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  IconButton,
  Chip,
  Typography,
  Box,
  Tooltip,
  Paper,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { useState } from "react";

import ProviderIcon from "@/components/ProviderIcon";
import { getProviderMetadata } from "@/services/issue-provider/registry";

import ProviderEditModal from "./ProviderEditModal";

interface Provider {
  id: string;
  type: string;
  displayName: string;
  baseUrl: string | null;
  iconUrl: string | null;
}

interface ProviderListProps {
  providers: Provider[];
  onDelete: (id: string) => void;
  onUpdated: (updated: Provider) => void;
}


/** Renders the list of issue providers with edit and delete actions. */
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
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {providers.map((provider, index) => (
          <Box key={provider.id}>
            {index > 0 && <Box sx={{ height: "1px", bgcolor: "divider" }} />}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              display: "flex",
              alignItems: "center",
              border: "none",
              borderRadius: 0,
              boxShadow: "none",
              transition: "background-color 0.2s",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <Box sx={{ mr: 2, display: "flex", alignItems: "center" }}>
              <ProviderIcon iconUrl={provider.iconUrl} label={provider.type} />
            </Box>
            <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: "medium" }}>
                {provider.displayName}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <Chip
                  label={getProviderMetadata(provider.type)?.displayName ?? provider.type}
                  size="small"
                  variant="outlined"
                  sx={{ flexShrink: 0 }}
                />
                {provider.baseUrl && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {provider.baseUrl}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1, ml: 2, flexShrink: 0 }}>
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
                  aria-label="delete"
                  onClick={() => onDelete(provider.id)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>
          </Box>
        ))}
      </Paper>

      {editingProvider && (
        <ProviderEditModal
          provider={editingProvider}
          open
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
