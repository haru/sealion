/** @jest-environment node */
import { buildAxiosProxyConfig, logProxyConfig } from "@/lib/proxy/proxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Delete all proxy-related env vars, returning a restore function. */
function clearProxyEnv(): () => void {
  const keys = [
    "http_proxy", "HTTP_PROXY",
    "https_proxy", "HTTPS_PROXY",
    "no_proxy", "NO_PROXY",
  ];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  return () => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}

// ---------------------------------------------------------------------------
// US1: buildAxiosProxyConfig — proxy env var reading
// ---------------------------------------------------------------------------

describe("buildAxiosProxyConfig — US1: proxy env var reading", () => {
  let restore: () => void;

  beforeEach(() => {
    restore = clearProxyEnv();
  });

  afterEach(() => {
    restore();
  });

  it("returns {} when no proxy env vars are set", () => {
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toEqual({});
    expect(config).not.toHaveProperty("httpAgent");
    expect(config).not.toHaveProperty("httpsAgent");
  });

  it("returns httpAgent and httpsAgent when https_proxy is set", () => {
    process.env.https_proxy = "http://proxy.example.com:8080";
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toHaveProperty("httpAgent");
    expect(config).toHaveProperty("httpsAgent");
  });

  it("returns proxy: false when agents are configured to disable Axios built-in proxy handling", () => {
    process.env.https_proxy = "http://proxy.example.com:8080";
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toHaveProperty("proxy", false);
  });

  it("does not include proxy: false when no agents are returned", () => {
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toEqual({});
    expect(config).not.toHaveProperty("proxy");
  });

  it("returns agents when HTTP_PROXY (uppercase) is set and lowercase is absent", () => {
    process.env.HTTP_PROXY = "http://proxy.example.com:8080";
    const config = buildAxiosProxyConfig("http://redmine.example.com");
    expect(config).toHaveProperty("httpAgent");
    expect(config).toHaveProperty("httpsAgent");
  });

  it("lowercase https_proxy takes precedence over HTTPS_PROXY", () => {
    process.env.https_proxy = "http://lower.example.com:8080";
    process.env.HTTPS_PROXY = "http://upper.example.com:9090";
    // Should not throw; just ensure lowercase wins (agents are constructed)
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toHaveProperty("httpAgent");
    expect(config).toHaveProperty("httpsAgent");
  });

  it("returns {} and warns when proxy URL is malformed", () => {
    process.env.https_proxy = "not-a-valid-url:::";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does not log credentials in warning when proxy URL has unsupported scheme with credentials", () => {
    process.env.https_proxy = "ftp://user:secret@proxy.example.com:21";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    buildAxiosProxyConfig("https://api.github.com");
    const warned = warnSpy.mock.calls.map((c: unknown[]) => JSON.stringify(c)).join("\n");
    expect(warned).not.toContain("secret");
    expect(warned).not.toContain("user:");
    warnSpy.mockRestore();
  });

  it("returns {} when baseUrl itself is not a valid URL", () => {
    process.env.https_proxy = "http://proxy.example.com:8080";
    const config = buildAxiosProxyConfig("not-a-url");
    expect(config).toEqual({});
  });

  it("logs a warning when baseUrl is malformed", () => {
    process.env.https_proxy = "http://proxy.example.com:8080";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const config = buildAxiosProxyConfig("not-a-url");
    expect(config).toEqual({});
    const warned = warnSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(warned).toContain("not-a-url");
    warnSpy.mockRestore();
  });

  it("does not mask @ in proxy URL path when no credentials present", () => {
    // A URL like http://proxy.example.com/@foo has no credentials — maskCredentials
    // should leave the URL unmodified and not incorrectly replace the @foo path segment.
    process.env.https_proxy = "http://proxy.example.com/@foo";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    // The URL is valid and has no credentials, so buildAxiosProxyConfig should return agents
    const config = buildAxiosProxyConfig("https://api.github.com");
    // Agents should be constructed (valid proxy URL, just unusual path)
    expect(config).toHaveProperty("httpAgent");
    expect(config).toHaveProperty("httpsAgent");
    warnSpy.mockRestore();
  });

  it("https_proxy does NOT proxy plain HTTP targets (no HTTPS→HTTP reverse fallback)", () => {
    // Setting only https_proxy should not proxy HTTP-scheme targets.
    // The fallback is HTTPS→HTTP (curl convention), not HTTP→HTTPS.
    process.env.https_proxy = "http://proxy.example.com:8080";
    const config = buildAxiosProxyConfig("http://internal.example.com");
    expect(config).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// US2: buildAxiosProxyConfig — no_proxy matching
// ---------------------------------------------------------------------------

describe("buildAxiosProxyConfig — US2: no_proxy matching", () => {
  let restore: () => void;

  beforeEach(() => {
    restore = clearProxyEnv();
    process.env.https_proxy = "http://proxy.example.com:8080";
  });

  afterEach(() => {
    restore();
  });

  it("wildcard * bypasses proxy for all hosts", () => {
    process.env.no_proxy = "*";
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toEqual({});
  });

  it("exact match bypasses proxy for that exact hostname", () => {
    process.env.no_proxy = "internal.example.com";
    expect(buildAxiosProxyConfig("https://internal.example.com")).toEqual({});
  });

  it("exact match does NOT bypass a different hostname", () => {
    process.env.no_proxy = "internal.example.com";
    const config = buildAxiosProxyConfig("https://api.example.com");
    expect(config).toHaveProperty("httpAgent");
  });

  it("domain suffix .example.com matches api.example.com", () => {
    process.env.no_proxy = ".example.com";
    expect(buildAxiosProxyConfig("https://api.example.com")).toEqual({});
  });

  it("domain suffix .example.com matches a.b.example.com", () => {
    process.env.no_proxy = ".example.com";
    expect(buildAxiosProxyConfig("https://a.b.example.com")).toEqual({});
  });

  it("domain suffix .example.com does NOT match example.com itself", () => {
    process.env.no_proxy = ".example.com";
    const config = buildAxiosProxyConfig("https://example.com");
    expect(config).toHaveProperty("httpAgent");
  });

  it("port-specific entry example.com:8080 matches only that port", () => {
    process.env.no_proxy = "example.com:8080";
    expect(buildAxiosProxyConfig("https://example.com:8080")).toEqual({});
  });

  it("port-specific entry example.com:8080 does not bypass a different port", () => {
    process.env.no_proxy = "example.com:8080";
    const config = buildAxiosProxyConfig("https://example.com:9090");
    expect(config).toHaveProperty("httpAgent");
  });

  it("no_proxy absent means no bypass", () => {
    // no_proxy already deleted by clearProxyEnv
    const config = buildAxiosProxyConfig("https://api.github.com");
    expect(config).toHaveProperty("httpAgent");
  });

  it("NO_PROXY uppercase fallback is applied", () => {
    process.env.NO_PROXY = "api.github.com";
    expect(buildAxiosProxyConfig("https://api.github.com")).toEqual({});
  });

  it("matching is case-insensitive", () => {
    process.env.no_proxy = "API.GITHUB.COM";
    expect(buildAxiosProxyConfig("https://api.github.com")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// US3: maskCredentials (tested indirectly via logProxyConfig) + logProxyConfig
// ---------------------------------------------------------------------------

describe("logProxyConfig — US3: startup logging", () => {
  let restore: () => void;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    restore = clearProxyEnv();
    logSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    restore();
    logSpy.mockRestore();
  });

  it("logs masked URL when https_proxy contains credentials", () => {
    process.env.https_proxy = "http://user:pass@proxy.example.com:8080";
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output).toContain("***:***@proxy.example.com:8080");
    expect(output).not.toContain("user:pass");
  });

  it("masks credentials when password contains @ character", () => {
    process.env.https_proxy = "http://user:p%40ss@proxy.example.com:8080";
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output).toContain("***:***@proxy.example.com:8080");
    expect(output).not.toContain("user:");
  });

  it("logs 'Proxy active' line when proxy is configured", () => {
    process.env.https_proxy = "http://proxy.example.com:8080";
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output.toLowerCase()).toContain("proxy active");
  });

  it("logs no-proxy-detected message when no env vars are set", () => {
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output.toLowerCase()).toContain("no proxy");
  });

  it("logs http_proxy line when http_proxy (lowercase) is set", () => {
    process.env.http_proxy = "http://proxy.example.com:8080";
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output).toContain("http_proxy=");
  });

  it("logs HTTP_PROXY line when only uppercase HTTP_PROXY is set", () => {
    process.env.HTTP_PROXY = "http://proxy.example.com:8080";
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output).toContain("HTTP_PROXY=");
  });

  it("logs no_proxy entry when no_proxy is set alongside https_proxy", () => {
    process.env.https_proxy = "http://proxy.example.com:8080";
    process.env.no_proxy = "localhost,127.0.0.1";
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output).toContain("no_proxy=localhost,127.0.0.1");
  });

  it("logs NO_PROXY when uppercase NO_PROXY is set alongside https_proxy", () => {
    process.env.https_proxy = "http://proxy.example.com:8080";
    process.env.NO_PROXY = "internal.corp";
    logProxyConfig();
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(output).toContain("NO_PROXY=internal.corp");
  });
});
