import { describe, expect, it } from "@jest/globals";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { theme } from "@/lib/ui/theme";

describe("theme", () => {
  describe("palette", () => {
    it("uses light mode", () => {
      expect(theme.palette.mode).toBe("light");
    });

    it("sets primary color to indigo", () => {
      expect(theme.palette.primary.main).toBe("#3057d5");
    });

    it("sets background default", () => {
      expect(theme.palette.background.default).toBe("#f8fafc");
    });
  });

  describe("typography", () => {
    it("includes Inter font family", () => {
      expect(theme.typography.fontFamily).toContain("Inter");
    });

    it("disables button text transform via textTransform none", () => {
      // MUI merges the button variant — check the raw theme options
      const button = (theme.typography as Record<string, unknown>).button as Record<string, unknown>;
      expect(button?.textTransform).toBe("none");
    });
  });

  describe("shape", () => {
    it("sets border radius to 8", () => {
      expect(theme.shape.borderRadius).toBe(8);
    });
  });

  describe("shadows", () => {
    it("has exactly 25 shadow levels (indices 0–24)", () => {
      expect(theme.shadows).toHaveLength(25);
    });

    it("has 'none' as the first shadow (elevation 0)", () => {
      expect(theme.shadows[0]).toBe("none");
    });
  });

  describe("component overrides", () => {
    it("derives MuiButton outlinedPrimary colors from theme palette dynamically", () => {
      const buttonStyleOverrides = theme.components?.MuiButton?.styleOverrides;
      expect(typeof buttonStyleOverrides).toBe("function");

      const resolved = (buttonStyleOverrides as (theme: Theme, ownerState: Record<string, unknown>) => Record<string, unknown>)(theme, {});
      const outlinedPrimary = resolved.outlinedPrimary as Record<string, unknown>;
      expect(outlinedPrimary.color).toBe(theme.palette.primary.main);
      expect(outlinedPrimary.borderColor).toBe(alpha(theme.palette.primary.main, 0.4));

      const hover = (outlinedPrimary["&:hover"] as Record<string, unknown>);
      expect(hover.borderColor).toBe(theme.palette.primary.main);
      expect(hover.backgroundColor).toBe(alpha(theme.palette.primary.main, 0.04));
    });

    it("derives MuiOutlinedInput focus border from theme palette dynamically", () => {
      const inputStyleOverrides = theme.components?.MuiOutlinedInput?.styleOverrides;
      expect(typeof inputStyleOverrides).toBe("function");

      const resolved = (inputStyleOverrides as (theme: Theme, ownerState: Record<string, unknown>) => Record<string, unknown>)(theme, {});
      const root = resolved.root as Record<string, unknown>;
      const focusOutline = (root?.["&.Mui-focused .MuiOutlinedInput-notchedOutline"] as Record<string, unknown>);
      expect(focusOutline?.borderColor).toBe(theme.palette.primary.main);
    });
  });
});
