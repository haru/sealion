/** @jest-environment node */
import { GET, POST } from "@/app/api/sync/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    issueProvider: { findMany: jest.fn() },
  },
}));
jest.mock("@/services/sync", () => ({
  syncProviders: jest.fn().mockResolvedValue(undefined),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.issueProvider.findMany as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@ex.com", role: "USER" } };

function makeRequest(method: string): NextRequest {
  return new NextRequest("http://localhost/api/sync", { method });
}

describe("POST /api/sync", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 202 when authenticated", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const res = await POST(makeRequest("POST"));
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(json.data.syncing).toBe(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/sync", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with provider sync status", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindMany.mockResolvedValue([
      {
        id: "p1",
        displayName: "My GitHub",
        type: "GITHUB",
        projects: [{ id: "proj1", displayName: "repo", lastSyncedAt: new Date() }],
      },
    ]);

    const res = await GET(makeRequest("GET"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });
});
