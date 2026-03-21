/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    issueProvider: {
      findFirst: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET, POST } from "@/app/api/projects/route";

const mockAuth = auth as jest.Mock;
const mockProjectFindMany = prisma.project.findMany as jest.Mock;
const mockProjectCreate = prisma.project.create as jest.Mock;
const mockProjectFindFirst = prisma.project.findFirst as jest.Mock;
const mockProviderFindFirst = prisma.issueProvider.findFirst as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@ex.com", role: "USER" } };

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/projects", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/projects", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty list when no projects", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProjectFindMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  it("returns 200 with projects sorted by displayName", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProjectFindMany.mockResolvedValue([
      {
        id: "proj-1",
        externalId: "org/alpha",
        displayName: "alpha",
        lastSyncedAt: null,
        syncError: null,
        includeUnassigned: false,
        issueProvider: { id: "p1", displayName: "My GitHub", type: "GITHUB" },
      },
      {
        id: "proj-2",
        externalId: "org/beta",
        displayName: "beta",
        lastSyncedAt: null,
        syncError: null,
        includeUnassigned: true,
        issueProvider: { id: "p1", displayName: "My GitHub", type: "GITHUB" },
      },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].displayName).toBe("alpha");
    expect(json.data[0].issueProvider.type).toBe("GITHUB");
  });

  it("includes includeUnassigned field in each project", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProjectFindMany.mockResolvedValue([
      {
        id: "proj-1",
        externalId: "org/repo",
        displayName: "repo",
        lastSyncedAt: null,
        syncError: null,
        includeUnassigned: true,
        issueProvider: { id: "p1", displayName: "My GitHub", type: "GITHUB" },
      },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0].includeUnassigned).toBe(true);
  });
});

describe("POST /api/projects", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", { issueProviderId: "p1", externalId: "org/repo", displayName: "repo" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const res = await POST(makeRequest("POST", { issueProviderId: "p1" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when provider does not belong to user", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProviderFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest("POST", { issueProviderId: "other-provider", externalId: "org/repo", displayName: "repo" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when externalId contains special characters", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProviderFindFirst.mockResolvedValue({ id: "p1", userId: "user-1" });

    const res = await POST(makeRequest("POST", { issueProviderId: "p1", externalId: 'PROJ" OR project = "OTHER', displayName: "test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when externalId contains whitespace", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProviderFindFirst.mockResolvedValue({ id: "p1", userId: "user-1" });

    const res = await POST(makeRequest("POST", { issueProviderId: "p1", externalId: "org repo", displayName: "test" }));
    expect(res.status).toBe(400);
  });

  it("accepts valid GitHub-style externalId (owner/repo)", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProviderFindFirst.mockResolvedValue({ id: "p1", userId: "user-1" });
    mockProjectFindFirst.mockResolvedValue(null);
    mockProjectCreate.mockResolvedValue({
      id: "new-proj",
      externalId: "org/repo",
      displayName: "repo",
      issueProvider: { id: "p1", displayName: "My GitHub", type: "GITHUB" },
    });

    const res = await POST(makeRequest("POST", { issueProviderId: "p1", externalId: "org/repo", displayName: "repo" }));
    expect(res.status).toBe(201);
  });

  it("returns 409 when project already registered", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProviderFindFirst.mockResolvedValue({ id: "p1", userId: "user-1" });
    mockProjectFindFirst.mockResolvedValue({ id: "existing-proj" });

    const res = await POST(makeRequest("POST", { issueProviderId: "p1", externalId: "org/repo", displayName: "repo" }));
    expect(res.status).toBe(409);
  });

  it("returns 201 and creates project when valid", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockProviderFindFirst.mockResolvedValue({ id: "p1", userId: "user-1" });
    mockProjectFindFirst.mockResolvedValue(null);
    mockProjectCreate.mockResolvedValue({
      id: "new-proj",
      externalId: "org/repo",
      displayName: "repo",
      issueProvider: { id: "p1", displayName: "My GitHub", type: "GITHUB" },
    });

    const res = await POST(makeRequest("POST", { issueProviderId: "p1", externalId: "org/repo", displayName: "repo" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.id).toBe("new-proj");
    expect(json.data.issueProvider.type).toBe("GITHUB");
  });
});
