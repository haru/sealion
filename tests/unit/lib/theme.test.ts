import { describe, it, expect } from "@jest/globals";
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
    it("uses the current primary color in MuiButton outlinedPrimary", () => {
      const outlinedPrimary = (theme.components?.MuiButton?.styleOverrides as Record<string, unknown>)?.outlinedPrimary as Record<string, unknown>;
      expect(outlinedPrimary?.color).toBe(theme.palette.primary.main);
    });

    it("uses the current primary color in MuiOutlinedInput focus border", () => {
      const root = (theme.components?.MuiOutlinedInput?.styleOverrides as Record<string, unknown>)?.root as Record<string, unknown>;
      const focusOutline = (root?.["&.Mui-focused .MuiOutlinedInput-notchedOutline"] as Record<string, unknown>);
      expect(focusOutline?.borderColor).toBe(theme.palette.primary.main);
    });
  });
});
