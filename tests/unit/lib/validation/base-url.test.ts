/** @jest-environment node */
import { getBaseUrlValidationError, isValidBaseUrl } from "@/lib/validation/base-url";

describe("isValidBaseUrl", () => {
  describe("valid URLs", () => {
    it("accepts https URL with hostname", () => {
      expect(isValidBaseUrl("https://github.example.com")).toBe(true);
    });

    it("accepts http URL with hostname", () => {
      expect(isValidBaseUrl("http://github.example.com")).toBe(true);
    });

    it("accepts https URL with trailing slash", () => {
      expect(isValidBaseUrl("https://github.example.com/")).toBe(true);
    });

    it("accepts https URL with port", () => {
      expect(isValidBaseUrl("https://github.example.com:8080")).toBe(true);
    });

    it("accepts https URL with path", () => {
      expect(isValidBaseUrl("https://github.example.com/ghe")).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("rejects empty string", () => {
      expect(isValidBaseUrl("")).toBe(false);
    });

    it("rejects plain hostname with no scheme", () => {
      expect(isValidBaseUrl("github.example.com")).toBe(false);
    });

    it("rejects ftp scheme", () => {
      expect(isValidBaseUrl("ftp://github.example.com")).toBe(false);
    });

    it("rejects arbitrary text", () => {
      expect(isValidBaseUrl("notaurl")).toBe(false);
    });

    it("rejects URL with no host", () => {
      expect(isValidBaseUrl("https://")).toBe(false);
    });

    it("rejects javascript scheme", () => {
      expect(isValidBaseUrl("javascript:alert(1)")).toBe(false);
    });
  });

  describe("SSRF mitigations — private/loopback addresses", () => {
    it("rejects localhost", () => {
      expect(isValidBaseUrl("http://localhost")).toBe(false);
    });

    it("rejects 127.0.0.1 (IPv4 loopback)", () => {
      expect(isValidBaseUrl("http://127.0.0.1")).toBe(false);
    });

    it("rejects 127.x.x.x range", () => {
      expect(isValidBaseUrl("http://127.99.1.2")).toBe(false);
    });

    it("rejects 169.254.x.x (APIPA / link-local)", () => {
      expect(isValidBaseUrl("http://169.254.169.254")).toBe(false);
    });

    it("rejects 10.x.x.x (RFC1918 class A)", () => {
      expect(isValidBaseUrl("http://10.0.0.1")).toBe(false);
    });

    it("rejects 192.168.x.x (RFC1918 class C)", () => {
      expect(isValidBaseUrl("http://192.168.1.1")).toBe(false);
    });

    it("rejects 172.16-31.x.x (RFC1918 class B)", () => {
      expect(isValidBaseUrl("http://172.16.0.1")).toBe(false);
      expect(isValidBaseUrl("http://172.31.255.255")).toBe(false);
    });

    it("rejects 0.0.0.0", () => {
      expect(isValidBaseUrl("http://0.0.0.0")).toBe(false);
    });

    it("rejects IPv6 loopback ::1", () => {
      expect(isValidBaseUrl("http://[::1]")).toBe(false);
    });

    it("rejects IPv6 link-local fe80::", () => {
      expect(isValidBaseUrl("http://[fe80::1]")).toBe(false);
    });

    it("rejects IPv6 unique-local fc00::", () => {
      expect(isValidBaseUrl("http://[fc00::1]")).toBe(false);
    });

    it("rejects IPv6 unique-local fd00:: (upper half of fc00::/7)", () => {
      expect(isValidBaseUrl("http://[fd00::1]")).toBe(false);
    });
  });

  describe("SSRF mitigations — embedded credentials", () => {
    it("rejects URL with username", () => {
      expect(isValidBaseUrl("https://user@github.example.com")).toBe(false);
    });

    it("rejects URL with username and password", () => {
      expect(isValidBaseUrl("https://user:pass@github.example.com")).toBe(false);
    });
  });
});

describe("getBaseUrlValidationError", () => {
  it("returns null when enabled=false", () => {
    expect(getBaseUrlValidationError(false, true, "bad", "Error msg")).toBeNull();
  });

  it("returns null when touched=false", () => {
    expect(getBaseUrlValidationError(true, false, "bad", "Error msg")).toBeNull();
  });

  it("returns error message when enabled, touched, and value is empty (required)", () => {
    expect(getBaseUrlValidationError(true, true, "", "Error msg")).toBe("Error msg");
  });

  it("returns null when value is valid", () => {
    expect(getBaseUrlValidationError(true, true, "https://example.com", "Error msg")).toBeNull();
  });

  it("returns error message when value is invalid", () => {
    expect(getBaseUrlValidationError(true, true, "notaurl", "Invalid URL")).toBe("Invalid URL");
  });
});
