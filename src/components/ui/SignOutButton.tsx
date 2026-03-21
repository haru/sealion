"use client";

import Button from "@mui/material/Button";
import { signOut } from "next-auth/react";

interface SignOutButtonProps {
  label: string;
}

/** Button that signs the user out and redirects to the login page. */
export function SignOutButton({ label }: SignOutButtonProps) {
  return (
    <Button color="inherit" onClick={() => signOut({ callbackUrl: "/login" })}>
      {label}
    </Button>
  );
}
