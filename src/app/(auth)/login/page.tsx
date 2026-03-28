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
    <Card
      elevation={0}
      sx={{
        width: "100%",
        borderRadius: 4,
        boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: { xs: 4, sm: 5 } }}>
        <Typography variant="h5" component="h2" fontWeight="700" textAlign="center" gutterBottom sx={{ mb: 3 }}>
          {t("loginTitle")}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {t(error as Parameters<typeof t>[0])}
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
            autoComplete="current-password"
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
            {t("login")}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, mb: 1, textAlign: "center" }}>
          {t("noAccount")}{" "}
          <Link href="/signup" style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}>
            <Box component="span" sx={{ color: "primary.main", "&:hover": { textDecoration: "underline" } }}>
              {t("signup")}
            </Box>
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
