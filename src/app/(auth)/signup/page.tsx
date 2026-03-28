"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { AuthCard } from "@/components/ui/AuthCard";
import { AuthFooterLink } from "@/components/ui/AuthFooterLink";

/** Sign-up page for creating a new user account. */
export default function SignupPage() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Submits the signup form to the API and redirects to the login page on success. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "error");
      return;
    }

    router.push("/login");
  }

  return (
    <AuthCard>
      <Typography variant="h5" component="h2" fontWeight="700" textAlign="center" gutterBottom sx={{ mb: 3 }}>
        {t("signupTitle")}
      </Typography>

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
          label={t("password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          inputProps={{ minLength: 8 }}
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
          {t("signup")}
        </Button>
      </Box>

      <AuthFooterLink prompt={t("hasAccount")} href="/login" label={t("login")} />
    </AuthCard>
  );
}
