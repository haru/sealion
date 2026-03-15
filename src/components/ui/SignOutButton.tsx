"use client";

import Button from "@mui/material/Button";
import { signOut } from "next-auth/react";

interface SignOutButtonProps {
  label: string;
}

export function SignOutButton({ label }: SignOutButtonProps) {
  return (
    <Button color="inherit" onClick={() => signOut({ callbackUrl: "/login" })}>
      {label}
    </Button>
  );
}
