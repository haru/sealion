/** @jest-environment node */
import { GET, PUT } from "@/app/api/providers/[id]/projects/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    issueProvider: { findFirst: jest.fn() },
    project: { upsert: jest.fn() },
  },
}));
jest.mock("@/lib/encryption", () => ({
  decrypt: jest.fn().mockReturnValue(JSON.stringify({ token: "test" })),
}));
jest.mock("@/services/issue-provider/factory", () => ({
  createAdapter: jest.fn().mockReturnValue({
    listProjects: jest.fn().mockResolvedValue([
      { externalId: "owner/repo", displayName: "owner/repo" },
    ]),
  }),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindFirst = prisma.issueProvider.findFirst as jest.Mock;
const mockUpsert = prisma.project.upsert as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@ex.com", role: "USER" } };
const PROVIDER = {
  id: "p1",
  type: "GITHUB",
  encryptedCredentials: "encrypted",
  userId: "user-1",
  projects: [{ externalId: "owner/repo", isEnabled: true }],
};

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/providers/p1/projects", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/providers/[id]/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 200 with projects including isEnabled flag", async () => {
    mockFindFirst.mockResolvedValue(PROVIDER);

    const res = await GET(makeRequest("GET"), { params: Promise.resolve({ id: "p1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0]).toMatchObject({
      externalId: "owner/repo",
      isEnabled: true,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when provider not owned by user", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/providers/[id]/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 200 and upserts projects", async () => {
    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1" });
    mockUpsert.mockResolvedValue({});

    const res = await PUT(
      makeRequest("PUT", {
        projects: [{ externalId: "owner/repo", displayName: "owner/repo", isEnabled: true }],
      }),
      { params: Promise.resolve({ id: "p1" }) }
    );

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when provider not owned by user", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await PUT(
      makeRequest("PUT", { projects: [] }),
      { params: Promise.resolve({ id: "p1" }) }
    );
    expect(res.status).toBe(403);
  });
});
