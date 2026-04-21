"use client";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import UserAvatar from "@/components/ui/UserAvatar";

/** Props for the {@link AccountMenu} component. */
export interface AccountMenuProps {
  /** Authenticated user's email address, used to derive initials and display in the dropdown. */
  email: string;
  /** Whether the user has enabled Gravatar as their avatar. */
  useGravatar: boolean;
}

/**
 * Account icon button in the titlebar that opens a dropdown menu.
 *
 * Displays the user's avatar (Gravatar or email initial) in a circular avatar. On click, opens
 * a MUI Menu containing:
 *  - the user's email address (non-interactive display)
 *  - a link to Profile Settings (`/settings/profile`)
 *  - a link to Issue Management Settings (`/settings/providers`)
 *  - a Log Out button
 *
 * @param props - Component props containing the authenticated user's email and Gravatar preference.
 * @returns The account icon button and its dropdown menu.
 */
export default function AccountMenu({ email, useGravatar }: AccountMenuProps) {
  const t = useTranslations("accountMenu");
  const tAuth = useTranslations("auth");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      <IconButton
        data-testid="account-menu-button"
        aria-label={t("ariaLabel")}
        aria-controls={open ? "account-menu-dropdown" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleOpen}
        size="small"
        sx={{ ml: 1 }}
      >
        <UserAvatar email={email} useGravatar={useGravatar} size={32} />
      </IconButton>

      <Menu
        id="account-menu-dropdown"
        data-testid="account-menu-dropdown"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            elevation: 2,
            sx: { minWidth: 220, mt: 0.5 },
          },
        }}
      >
        {/* Email display — non-interactive */}
        <Box
          data-testid="account-menu-email"
          sx={{ px: 2, py: 1.5 }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {email}
          </Typography>
        </Box>

        <Divider />

        {/* Profile Settings */}
        <MenuItem
          data-testid="account-menu-profile"
          component={Link}
          href="/settings/profile"
          onClick={handleClose}
        >
          <ListItemIcon>
            <AccountCircleIcon fontSize="small" />
          </ListItemIcon>
          {t("profileSettings")}
        </MenuItem>

        {/* Issue Management Settings */}
        <MenuItem
          data-testid="account-menu-issue-settings"
          component={Link}
          href="/settings/providers"
          onClick={handleClose}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          {t("issueSettings")}
        </MenuItem>

        <Divider />

        {/* Log Out */}
        <MenuItem
          data-testid="account-menu-logout"
          onClick={handleLogout}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          {tAuth("logout")}
        </MenuItem>
      </Menu>
    </>
  );
}
