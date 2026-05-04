"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthCard } from "@/components/ui/AuthCard";
import { AuthFooterLink } from "@/components/ui/AuthFooterLink";

/** Admin account setup page shown on first application access when no users exist. */
export default function SetupPage() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Submits the setup form to create the first administrator account. */
  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username: username.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "INTERNAL_ERROR");
        return;
      }

      router.push("/login");
    } catch {
      setError("INTERNAL_ERROR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 2, fontWeight: 700, textAlign: "center" }}>
        {t("setupTitle")}
      </Typography>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        {t("setupInfo")}
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {tErrors(error as Parameters<typeof tErrors>[0])}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <TextField
          label={t("email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          autoComplete="email"
          variant="outlined"
        />
        <TextField
          label={t("username")}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          fullWidth
          autoComplete="username"
          variant="outlined"
        />
        <TextField
          label={t("password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { minLength: 8 } }}
          autoComplete="new-password"
          variant="outlined"
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={loading}
          sx={{
            mt: 1,
            py: 1.5,
            borderRadius: 2,
            fontWeight: "bold",
            textTransform: "none",
            fontSize: "1rem",
          }}
        >
          {t("setupSubmit")}
        </Button>
      </Box>

      <AuthFooterLink prompt={t("hasAccount")} href="/login" label={t("login")} />
    </AuthCard>
  );
}
