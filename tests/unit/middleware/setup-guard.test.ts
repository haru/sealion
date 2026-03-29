/** @jest-environment node */

// Mock next-auth and auth.config before importing middleware to avoid ESM issues
jest.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({ auth: (fn: unknown) => fn }),
}));
jest.mock("../../../src/lib/auth.config", () => ({ authConfig: {} }));

import { setupGuard } from "../../../middleware";
import { NextRequest } from "next/server";

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

describe("setupGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- US1: Redirect to /setup when needsSetup=true ---

  it("redirects to /setup when needsSetup=true and path is not /setup", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: true }, error: null }),
    } as Response);

    const req = makeRequest("/");
    const result = await setupGuard(req);

    expect(result).not.toBeNull();
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/setup");
  });

  it("redirects to /setup when needsSetup=true and path is /login", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: true }, error: null }),
    } as Response);

    const req = makeRequest("/login");
    const result = await setupGuard(req);

    expect(result).not.toBeNull();
    expect(result?.headers.get("location")).toContain("/setup");
  });

  it("returns null when needsSetup=true and path is already /setup", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: true }, error: null }),
    } as Response);

    const req = makeRequest("/setup");
    const result = await setupGuard(req);

    expect(result).toBeNull();
  });

  // --- US2: Redirect /setup to /login when needsSetup=false ---

  it("redirects /setup to /login when needsSetup=false", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: false }, error: null }),
    } as Response);

    const req = makeRequest("/setup");
    const result = await setupGuard(req);

    expect(result).not.toBeNull();
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/login");
  });

  it("returns null when needsSetup=false and path is not /setup", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: false }, error: null }),
    } as Response);

    const req = makeRequest("/");
    const result = await setupGuard(req);

    expect(result).toBeNull();
  });

  // --- Skips /api/* paths ---

  it("returns null for /api/* paths without calling fetch", async () => {
    global.fetch = jest.fn();

    const req = makeRequest("/api/some-endpoint");
    const result = await setupGuard(req);

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // --- Error handling: fetch fails → no redirect ---

  it("returns null when fetch throws (fail-safe: no redirect on error)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const req = makeRequest("/");
    const result = await setupGuard(req);

    expect(result).toBeNull();
  });

  it("returns null when fetch returns non-ok response (fail-safe)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ data: null, error: "INTERNAL_ERROR" }),
    } as Response);

    const req = makeRequest("/");
    const result = await setupGuard(req);

    expect(result).toBeNull();
  });
});
