/** @jest-environment node */
import { GET } from "@/app/api/providers/[id]/projects/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    issueProvider: { findFirst: jest.fn() },
    project: { findMany: jest.fn() },
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
const mockProjectFindMany = prisma.project.findMany as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@ex.com", role: "USER" } };
const PROVIDER = {
  id: "p1",
  type: "GITHUB",
  encryptedCredentials: "encrypted",
  userId: "user-1",
};

function makeRequest(method: string): NextRequest {
  return new NextRequest("http://localhost/api/providers/p1/projects", { method });
}

describe("GET /api/providers/[id]/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 200 with projects including isRegistered flag", async () => {
    mockFindFirst.mockResolvedValue(PROVIDER);
    mockProjectFindMany.mockResolvedValue([{ externalId: "owner/repo" }]);

    const res = await GET(makeRequest("GET"), { params: Promise.resolve({ id: "p1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0]).toMatchObject({
      externalId: "owner/repo",
      isRegistered: true,
    });
  });

  it("returns isRegistered: false for unregistered projects", async () => {
    mockFindFirst.mockResolvedValue(PROVIDER);
    mockProjectFindMany.mockResolvedValue([]); // no registered projects

    const res = await GET(makeRequest("GET"), { params: Promise.resolve({ id: "p1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0]).toMatchObject({
      externalId: "owner/repo",
      isRegistered: false,
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
