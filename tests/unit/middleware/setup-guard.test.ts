/** @jest-environment node */

import { setupGuard } from "../../../src/lib/setup-guard";
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

  // --- Skips irrelevant static/asset paths to avoid redundant DB calls ---

  it("returns null for /_next/* paths without calling fetch", async () => {
    global.fetch = jest.fn();

    const req = makeRequest("/_next/static/chunk.js");
    const result = await setupGuard(req);

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null for /favicon.ico without calling fetch", async () => {
    global.fetch = jest.fn();

    const req = makeRequest("/favicon.ico");
    const result = await setupGuard(req);

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // --- Only calls fetch for paths that the guard actually needs to evaluate ---

  it("calls fetch for / (protected route that needs guard evaluation)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: false }, error: null }),
    } as Response);

    const req = makeRequest("/");
    await setupGuard(req);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("calls fetch for /login (auth page that needs guard evaluation)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: false }, error: null }),
    } as Response);

    const req = makeRequest("/login");
    await setupGuard(req);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("calls fetch for /setup (always needs evaluation)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { needsSetup: false }, error: null }),
    } as Response);

    const req = makeRequest("/setup");
    await setupGuard(req);

    expect(global.fetch).toHaveBeenCalledTimes(1);
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
