import { getGravatarUrl } from "@/lib/gravatar/gravatar";

describe("getGravatarUrl", () => {
  test("returns correct URL format with MD5 hash", () => {
    // MD5 of "test@example.com" = 55502f40dc8b7c769880b10874abc9d0
    const url = getGravatarUrl("test@example.com", 32);
    expect(url).toBe("https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=32&d=404");
  });

  test("trims and lowercases email before hashing", () => {
    const normalized = getGravatarUrl("test@example.com", 32);
    const withSpaces = getGravatarUrl("  TEST@EXAMPLE.COM  ", 32);
    expect(withSpaces).toBe(normalized);
  });

  test("uses custom size parameter", () => {
    const url = getGravatarUrl("test@example.com", 64);
    expect(url).toContain("?s=64&d=404");
  });

  test("defaults to size 32 when size is omitted", () => {
    const url = getGravatarUrl("test@example.com");
    expect(url).toContain("?s=32&d=404");
  });

  test("handles empty string input", () => {
    // MD5 of "" = d41d8cd98f00b204e9800998ecf8427e
    const url = getGravatarUrl("", 32);
    expect(url).toBe("https://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=32&d=404");
  });

  test("always appends d=404 for unregistered email fallback", () => {
    const url = getGravatarUrl("unregistered@nowhere.test", 32);
    expect(url).toContain("d=404");
  });
});
