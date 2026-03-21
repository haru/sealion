"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Link from "next/link";

/** Login page with email and password credentials form. */
export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Submits credentials to Auth.js and redirects on success. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("invalidCredentials");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <Card sx={{ minWidth: 360, maxWidth: 400, width: "100%", mx: 2 }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {t("loginTitle")}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t(error as Parameters<typeof t>[0])}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label={t("email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
          />
          <TextField
            label={t("password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />
          <Button type="submit" variant="contained" fullWidth disabled={loading}>
            {t("login")}
          </Button>
        </Box>

        <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
          {t("noAccount")}{" "}
          <Link href="/signup">{t("signup")}</Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
