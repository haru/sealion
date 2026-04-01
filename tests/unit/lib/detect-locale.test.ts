import { detectLocale } from "@/i18n/request";

describe("detectLocale", () => {
  it("returns 'en' when Accept-Language is empty", () => {
    expect(detectLocale("")).toBe("en");
  });

  it("returns 'en' when browser language is English only", () => {
    expect(detectLocale("en-US")).toBe("en");
    expect(detectLocale("en")).toBe("en");
  });

  it("returns 'ja' when browser language is Japanese only", () => {
    expect(detectLocale("ja")).toBe("ja");
    expect(detectLocale("ja-JP")).toBe("ja");
  });

  it("returns 'en' when English has higher priority than Japanese", () => {
    // Chrome set to English with Japanese as fallback — this was the bug
    expect(detectLocale("en-US,en;q=0.9,ja;q=0.8")).toBe("en");
  });

  it("returns 'ja' when Japanese has higher priority than English", () => {
    expect(detectLocale("ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("ja");
  });

  it("returns 'en' for unsupported primary locale with no fallback", () => {
    expect(detectLocale("fr-FR,fr;q=0.9")).toBe("en");
  });

  it("returns 'ja' for unsupported primary locale with Japanese as fallback", () => {
    expect(detectLocale("fr-FR,fr;q=0.9,ja;q=0.8")).toBe("ja");
  });

  it("handles missing q value (defaults to 1.0)", () => {
    expect(detectLocale("en-US,ja")).toBe("en");
  });

  it("handles whitespace around entries", () => {
    expect(detectLocale("en-US, en;q=0.9, ja;q=0.8")).toBe("en");
  });
});
