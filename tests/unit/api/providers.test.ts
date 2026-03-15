/** @jest-environment node */
import { GET, POST } from "@/app/api/providers/route";
import { DELETE } from "@/app/api/providers/[id]/route";
import { NextRequest } from "next/server";

// Mock next-intl
jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn().mockResolvedValue((key: string) => key),
}));

// Mock Auth.js session
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

// Mock Prisma
jest.mock("@/lib/db", () => ({
  prisma: {
    issueProvider: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock encryption
jest.mock("@/lib/encryption", () => ({
  encrypt: jest.fn().mockReturnValue("encrypted:credentials"),
  decrypt: jest.fn().mockReturnValue("{}"),
}));

// Mock adapters
jest.mock("@/services/issue-provider/github", () => ({
  GitHubAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.issueProvider.findMany as jest.Mock;
const mockCreate = prisma.issueProvider.create as jest.Mock;
const mockFindFirst = prisma.issueProvider.findFirst as jest.Mock;
const mockDelete = prisma.issueProvider.delete as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

function makeRequest(method: string, body?: object, url = "http://localhost/api/providers"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/providers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 200 with provider list", async () => {
    mockFindMany.mockResolvedValue([
      { id: "p1", type: "GITHUB", displayName: "GitHub", createdAt: new Date() },
    ]);

    const req = makeRequest("GET");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].type).toBe("GITHUB");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("GET");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/providers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 201 with created provider on success", async () => {
    mockCreate.mockResolvedValue({
      id: "p1",
      type: "GITHUB",
      displayName: "My GitHub",
      createdAt: new Date(),
    });

    const req = makeRequest("POST", {
      type: "GITHUB",
      displayName: "My GitHub",
      credentials: { token: "ghp_test" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.type).toBe("GITHUB");
  });

  it("returns 422 when credentials are invalid (connection fails)", async () => {
    const { GitHubAdapter } = jest.requireMock("@/services/issue-provider/github");
    GitHubAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockRejectedValue(new Error("Unauthorized")),
    }));

    const req = makeRequest("POST", {
      type: "GITHUB",
      displayName: "Bad GitHub",
      credentials: { token: "invalid-token" },
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("POST", {
      type: "GITHUB",
      displayName: "My GitHub",
      credentials: { token: "ghp_test" },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/providers/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 200 when provider is deleted by owner", async () => {
    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1" });
    mockDelete.mockResolvedValue({ id: "p1" });

    const req = makeRequest("DELETE", undefined, "http://localhost/api/providers/p1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(200);
  });

  it("returns 403 when provider belongs to different user", async () => {
    mockFindFirst.mockResolvedValue(null);

    const req = makeRequest("DELETE", undefined, "http://localhost/api/providers/p1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("DELETE", undefined, "http://localhost/api/providers/p1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(401);
  });
});
