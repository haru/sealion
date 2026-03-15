"use client";

import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Typography,
  Box,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import GitHubIcon from "@mui/icons-material/GitHub";
import CloudIcon from "@mui/icons-material/Cloud";
import { useTranslations } from "next-intl";

interface Provider {
  id: string;
  type: "GITHUB" | "JIRA" | "REDMINE";
  displayName: string;
}

interface ProviderListProps {
  providers: Provider[];
  onDelete: (id: string) => void;
}

function ProviderIcon({ type }: { type: Provider["type"] }) {
  if (type === "GITHUB") return <GitHubIcon />;
  return <CloudIcon />;
}

export default function ProviderList({ providers, onDelete }: ProviderListProps) {
  const t = useTranslations("providers");

  if (providers.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        {t("noProviders")}
      </Typography>
    );
  }

  return (
    <List>
      {providers.map((provider) => (
        <ListItem key={provider.id} divider>
          <Box sx={{ mr: 2, display: "flex", alignItems: "center" }}>
            <ProviderIcon type={provider.type} />
          </Box>
          <ListItemText
            primary={provider.displayName}
            secondary={
              <Chip
                label={t(`type.${provider.type}`)}
                size="small"
                variant="outlined"
                sx={{ mt: 0.5 }}
              />
            }
          />
          <ListItemSecondaryAction>
            <IconButton
              edge="end"
              aria-label="delete"
              onClick={() => onDelete(provider.id)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </ListItemSecondaryAction>
        </ListItem>
      ))}
    </List>
  );
}
