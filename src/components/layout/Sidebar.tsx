"use client";

import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const DRAWER_WIDTH = 240;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant: "permanent" | "temporary";
}

export default function Sidebar({ open, onClose, variant }: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();

  const content = (
    <>
      <Toolbar />
      <List>
        <ListItemButton
          component={Link}
          href="/projects"
          selected={pathname === "/projects"}
          onClick={variant === "temporary" ? onClose : undefined}
        >
          <ListItemIcon>
            <FolderOpenIcon />
          </ListItemIcon>
          <ListItemText primary={t("projectManagement")} />
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
