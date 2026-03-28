"use client";

import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import TuneIcon from "@mui/icons-material/Tune";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const DRAWER_WIDTH = 240;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant: "permanent" | "temporary";
}

/** Navigation drawer with links to main sections of the dashboard. */
export default function Sidebar({ open, onClose, variant }: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();

  const content = (
    <>
      {/* Spacer to push nav below the AppBar */}
      <Box sx={{ height: 56 }} />
      <List sx={{ pt: 1, pb: 1 }}>
        <ListItemButton
          component={Link}
          href="/"
          selected={pathname === "/"}
          onClick={variant === "temporary" ? onClose : undefined}
        >
          <ListItemIcon>
            <FormatListBulletedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("todo")} />
        </ListItemButton>
        <ListItemButton
          component={Link}
          href="/projects"
          selected={pathname === "/projects"}
          onClick={variant === "temporary" ? onClose : undefined}
        >
          <ListItemIcon>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("projectManagement")} />
        </ListItemButton>
        <ListItemButton
          component={Link}
          href="/settings/board"
          selected={pathname === "/settings/board"}
          onClick={variant === "temporary" ? onClose : undefined}
        >
          <ListItemIcon>
            <TuneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("boardSettings")} />
        </ListItemButton>
      </List>
    </>
  );

  return (
    <Drawer
      variant={variant}
      open={variant === "temporary" ? open : true}
      onClose={onClose}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
        },
      }}
    >
      {content}
    </Drawer>
  );
}
