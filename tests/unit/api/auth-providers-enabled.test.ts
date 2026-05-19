/** @jest-environment node */
/**
 * Unit tests for GET /api/auth-providers/enabled (no DB required).
 * Uses jest.resetModules + jest.doMock to avoid real DB access.
 */

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));

function mockListEnabled(rows: unknown[]) {
  jest.resetModules();
  jest.doMock("@/services/auth-provider/repository", () => ({
    listEnabledDisplayOnly: jest.fn().mockResolvedValue(rows),
  }));
}

describe("GET /api/auth-providers/enabled — unit (no DB required)", () => {
  test("returns enabled providers with minimal display fields", async () => {
    mockListEnabled([
      { providerId: "google", type: "GOOGLE", displayName: "Google" },
    ]);
    const { GET } = await import("@/app/api/auth-providers/enabled/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toEqual({
      providerId: "google",
      type: "GOOGLE",
      displayName: "Google",
    });
  });

  test("returns empty array when no providers enabled", async () => {
    mockListEnabled([]);
    const { GET } = await import("@/app/api/auth-providers/enabled/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  test("sets Cache-Control header", async () => {
    mockListEnabled([]);
    const { GET } = await import("@/app/api/auth-providers/enabled/route");
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("max-age=30");
  });

  test("returns 500 when listEnabled throws", async () => {
    jest.resetModules();
    jest.doMock("@/services/auth-provider/repository", () => ({
      listEnabledDisplayOnly: jest.fn().mockRejectedValue(new Error("DB down")),
    }));
    const { GET } = await import("@/app/api/auth-providers/enabled/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
