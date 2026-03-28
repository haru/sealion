"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#4f46e5",
      light: "#818cf8",
      dark: "#3730a3",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#64748b",
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#64748b",
      disabled: "#cbd5e1",
    },
    divider: "#e2e8f0",
    error: {
      main: "#ef4444",
    },
    warning: {
      main: "#f59e0b",
    },
    success: {
      main: "#10b981",
    },
    action: {
      hover: "rgba(0, 0, 0, 0.04)",
      selected: "rgba(79, 70, 229, 0.08)",
    },
  },
  typography: {
    fontFamily: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
    h4: {
      fontWeight: 600,
      fontSize: "1.25rem",
      letterSpacing: "-0.02em",
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: "0.9375rem",
      letterSpacing: "-0.01em",
      lineHeight: 1.4,
    },
    body1: {
      fontSize: "0.875rem",
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.8125rem",
      lineHeight: 1.4,
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.4,
    },
    button: {
      textTransform: "none",
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    "none",
    "0 1px 2px 0 rgba(0,0,0,0.05)",
    "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)",
    "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06)",
    "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05)",
    "0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.05)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
    "0 25px 50px -12px rgba(0,0,0,0.15)",
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f9fafb",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#0f172a",
          boxShadow: "none",
          borderBottom: "1px solid #e2e8f0",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#f8fafc",
          borderRight: "1px solid #e2e8f0",
          boxShadow: "none",
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: "56px !important",
          paddingLeft: "16px !important",
          paddingRight: "16px !important",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          transition: "box-shadow 0.15s ease, border-color 0.15s ease",
          "&:hover": {
            boxShadow: "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)",
            borderColor: "#d1d5db",
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: "12px 16px",
          "&:last-child": {
            paddingBottom: "12px",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.8125rem",
          borderRadius: 6,
          padding: "4px 12px",
          lineHeight: 1.5,
          minHeight: 30,
        },
        outlined: {
          borderColor: "#e5e7eb",
          color: "#374151",
          "&:hover": {
            borderColor: "#d1d5db",
            backgroundColor: "#f9fafb",
          },
        },
        outlinedPrimary: {
          borderColor: "rgba(79, 70, 229, 0.4)",
          color: "#4f46e5",
          "&:hover": {
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.04)",
          },
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
        sizeSmall: {
          fontSize: "0.75rem",
          padding: "3px 10px",
          minHeight: 26,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: "0.6875rem",
          height: 20,
          borderRadius: 4,
          fontWeight: 500,
        },
        outlined: {
          borderColor: "#e5e7eb",
          color: "#6b7280",
          backgroundColor: "transparent",
        },
        sizeSmall: {
          height: 20,
          fontSize: "0.6875rem",
        },
        icon: {
          marginLeft: 6,
          marginRight: -2,
        },
        label: {
          paddingLeft: 7,
          paddingRight: 7,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          paddingTop: 7,
          paddingBottom: 7,
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.04)",
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 32,
          color: "#6b7280",
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "#374151",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: 6,
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.05)",
          },
        },
        sizeSmall: {
          padding: 4,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: "0.875rem",
          backgroundColor: "#ffffff",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e5e7eb",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#d1d5db",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#4f46e5",
            borderWidth: 1,
          },
        },
        input: {
          padding: "8px 12px",
          fontSize: "0.875rem",
        },
        inputSizeSmall: {
          padding: "6px 10px",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        outlined: {
          borderColor: "#e5e7eb",
        },
        elevation1: {
          boxShadow: "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "#e5e7eb",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: "0.75rem",
          backgroundColor: "#1f2937",
          borderRadius: 4,
          padding: "4px 8px",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.06)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "1rem",
          fontWeight: 600,
          padding: "20px 24px 12px",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "12px 24px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "12px 24px 20px",
          gap: 8,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: "0.875rem",
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          "& .MuiAlert-root": {
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.06)",
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: "#e5e7eb",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "#e5e7eb",
          fontSize: "0.875rem",
        },
        head: {
          fontWeight: 600,
          color: "#374151",
          backgroundColor: "#f9fafb",
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          "& .MuiPaginationItem-root": {
            borderRadius: 6,
            fontSize: "0.8125rem",
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontSize: "0.75rem",
          marginLeft: 0,
        },
      },
    },
  },
});
