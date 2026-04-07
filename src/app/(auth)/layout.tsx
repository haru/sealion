import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Image from "next/image";

/** Centered card layout for authentication pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #e0f2f1 0%, #bbdefb 100%)",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Box sx={{ mb: 4, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box
          sx={{
            width: 140,
            height: 140,
            bgcolor: "white",
            borderRadius: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            mb: 2,
          }}
        >
          <Image src="/sealion.svg" alt="" aria-hidden width={100} height={100} priority />
        </Box>
        <Typography
          variant="h3"
          component="h1"
          fontWeight="900"
          sx={{
            color: "primary.dark",
            letterSpacing: "-0.5px",
            textShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >
          Sealion
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{
            color: "primary.main",
            mt: 0.5,
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          All Your TODOs, One Place.
        </Typography>
      </Box>

      <Box sx={{ width: "100%", maxWidth: 440 }}>
        {children}
      </Box>
    </Box>
  );
}
