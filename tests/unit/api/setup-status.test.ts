/** @jest-environment node */
import { GET } from "@/app/api/auth/setup-status/route";
import { NextRequest } from "next/server";

// Mock Prisma
jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      count: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockCount = prisma.user.count as jest.Mock;

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/setup-status");
}

describe("GET /api/auth/setup-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns needsSetup: true when user count is 0", async () => {
    mockCount.mockResolvedValue(0);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.needsSetup).toBe(true);
    expect(json.error).toBeNull();
  });

  it("returns needsSetup: false when user count is 1", async () => {
    mockCount.mockResolvedValue(1);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.needsSetup).toBe(false);
    expect(json.error).toBeNull();
  });

  it("returns needsSetup: false when user count is greater than 1", async () => {
    mockCount.mockResolvedValue(5);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.needsSetup).toBe(false);
  });

  it("returns 500 when DB throws", async () => {
    mockCount.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });
});
