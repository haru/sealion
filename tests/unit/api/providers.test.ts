/** @jest-environment node */
import { GET, POST } from "@/app/api/providers/route";
import { DELETE, PATCH } from "@/app/api/providers/[id]/route";
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
      update: jest.fn(),
    },
  },
}));

// Mock encryption
jest.mock("@/lib/encryption", () => ({
  encrypt: jest.fn().mockReturnValue("encrypted:credentials"),
  decrypt: jest.fn().mockReturnValue("{}"),
}));

// Mock adapters (include static iconUrl so getProviderIconUrl() works)
jest.mock("@/services/issue-provider/github", () => ({
  GitHubAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/github.svg" }
  ),
}));

jest.mock("@/services/issue-provider/jira", () => ({
  JiraAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/jira.svg" }
  ),
}));

jest.mock("@/services/issue-provider/redmine", () => ({
  RedmineAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/redmine.svg" }
  ),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.issueProvider.findMany as jest.Mock;
const mockCreate = prisma.issueProvider.create as jest.Mock;
const mockFindFirst = prisma.issueProvider.findFirst as jest.Mock;
const mockDelete = prisma.issueProvider.delete as jest.Mock;
const mockUpdate = (prisma.issueProvider as unknown as { update: jest.Mock }).update;
const mockEncrypt = encrypt as jest.Mock;
const mockDecrypt = decrypt as jest.Mock;

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
      { id: "p1", type: "GITHUB", displayName: "GitHub", baseUrl: null, createdAt: new Date() },
    ]);

    const req = makeRequest("GET");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].type).toBe("GITHUB");
    expect(json.data[0].iconUrl).toBe("/github.svg");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("GET");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  // T013: GET includes baseUrl field
  it("returns baseUrl populated for Jira providers", async () => {
    mockFindMany.mockResolvedValue([
      { id: "p2", type: "JIRA", displayName: "My Jira", baseUrl: "https://example.atlassian.net", createdAt: new Date() },
    ]);

    const req = makeRequest("GET");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0].baseUrl).toBe("https://example.atlassian.net");
  });

  it("returns baseUrl as null for GitHub providers", async () => {
    mockFindMany.mockResolvedValue([
      { id: "p1", type: "GITHUB", displayName: "My GitHub", baseUrl: null, createdAt: new Date() },
    ]);

    const req = makeRequest("GET");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0].baseUrl).toBeNull();
  });

  it("includes baseUrl in the Prisma select query", async () => {
    mockFindMany.mockResolvedValue([]);

    const req = makeRequest("GET");
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ baseUrl: true }),
      })
    );
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
    expect(json.data.iconUrl).toBe("/github.svg");
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

  it("returns errorDetails in 422 response when connection test fails with axios error", async () => {
    const { GitHubAdapter } = jest.requireMock("@/services/issue-provider/github");
    const axiosError = Object.assign(new Error("Unauthorized"), {
      isAxiosError: true,
      response: { status: 401, data: { message: "Bad credentials" }, statusText: "Unauthorized" },
    });
    GitHubAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockRejectedValue(axiosError),
    }));

    const req = makeRequest("POST", {
      type: "GITHUB",
      displayName: "Bad GitHub",
      credentials: { token: "invalid-token" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("CONNECTION_TEST_FAILED");
    expect(json.errorDetails).toBeDefined();
    expect(json.errorDetails.cause).toBe("AUTHENTICATION");
    expect(json.errorDetails.statusCode).toBe(401);
    expect(json.errorDetails.providerMessage).toBe("Bad credentials");
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

// --- T003: POST baseUrl separation tests ---

describe("POST /api/providers — baseUrl separation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("stores Jira baseUrl in DB field, not in encryptedCredentials", async () => {
    const { JiraAdapter } = jest.requireMock("@/services/issue-provider/jira");
    JiraAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    }));

    mockCreate.mockResolvedValue({
      id: "p2",
      type: "JIRA",
      displayName: "My Jira",
      baseUrl: "https://example.atlassian.net",
      createdAt: new Date(),
    });

    const req = makeRequest("POST", {
      type: "JIRA",
      displayName: "My Jira",
      credentials: {
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "secret",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    // baseUrl must be stored in the DB field, not encrypted
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.baseUrl).toBe("https://example.atlassian.net");

    // encryptedCredentials must NOT contain baseUrl
    const encryptedArg = mockEncrypt.mock.calls[0][0];
    const parsed = JSON.parse(encryptedArg);
    expect(parsed).not.toHaveProperty("baseUrl");
    expect(parsed).toHaveProperty("email", "user@example.com");
    expect(parsed).toHaveProperty("apiToken", "secret");
  });

  it("stores Redmine baseUrl in DB field, not in encryptedCredentials", async () => {
    const { RedmineAdapter } = jest.requireMock("@/services/issue-provider/redmine");
    RedmineAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    }));

    mockCreate.mockResolvedValue({
      id: "p3",
      type: "REDMINE",
      displayName: "My Redmine",
      baseUrl: "https://redmine.example.com",
      createdAt: new Date(),
    });

    const req = makeRequest("POST", {
      type: "REDMINE",
      displayName: "My Redmine",
      credentials: {
        baseUrl: "https://redmine.example.com",
        apiKey: "redmine-key",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.baseUrl).toBe("https://redmine.example.com");

    const encryptedArg = mockEncrypt.mock.calls[0][0];
    const parsed = JSON.parse(encryptedArg);
    expect(parsed).not.toHaveProperty("baseUrl");
    expect(parsed).toHaveProperty("apiKey", "redmine-key");
  });

  it("stores GitHub with null baseUrl (no baseUrl in credentials)", async () => {
    mockCreate.mockResolvedValue({
      id: "p1",
      type: "GITHUB",
      displayName: "My GitHub",
      baseUrl: null,
      createdAt: new Date(),
    });

    const req = makeRequest("POST", {
      type: "GITHUB",
      displayName: "My GitHub",
      credentials: { token: "ghp_test" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.baseUrl).toBeUndefined();
  });
});

// --- T008: PATCH /api/providers/[id] tests ---

describe("PATCH /api/providers/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("PATCH", { displayName: "X", changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 403 when provider belongs to different user", async () => {
    mockFindFirst.mockResolvedValue(null);

    const req = makeRequest("PATCH", { displayName: "X", changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(403);
  });

  it("returns 400 when displayName is missing", async () => {
    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "GITHUB", encryptedCredentials: "enc" });

    const req = makeRequest("PATCH", { changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 when Jira/Redmine missing baseUrl", async () => {
    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "JIRA", encryptedCredentials: "enc", baseUrl: "https://old.atlassian.net" });
    mockDecrypt.mockReturnValue(JSON.stringify({ email: "u@example.com", apiToken: "tok" }));

    const req = makeRequest("PATCH", { displayName: "X", changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 when changeCredentials=true but credentials missing", async () => {
    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "GITHUB", encryptedCredentials: "enc", baseUrl: null });
    mockDecrypt.mockReturnValue(JSON.stringify({ token: "old" }));

    const req = makeRequest("PATCH", { displayName: "X", changeCredentials: true }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 200 updating name/URL without changing credentials (changeCredentials=false)", async () => {
    const { GitHubAdapter } = jest.requireMock("@/services/issue-provider/github");
    GitHubAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    }));

    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "GITHUB", encryptedCredentials: "enc", baseUrl: null });
    mockDecrypt.mockReturnValue(JSON.stringify({ token: "existing-token" }));
    mockUpdate.mockResolvedValue({ id: "p1", type: "GITHUB", displayName: "Updated", baseUrl: null, createdAt: new Date() });

    const req = makeRequest("PATCH", { displayName: "Updated", changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.displayName).toBe("Updated");
    expect(json.data.iconUrl).toBe("/github.svg");
  });

  it("returns 200 updating credentials when changeCredentials=true", async () => {
    const { GitHubAdapter } = jest.requireMock("@/services/issue-provider/github");
    GitHubAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    }));

    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "GITHUB", encryptedCredentials: "enc", baseUrl: null });
    mockDecrypt.mockReturnValue(JSON.stringify({ token: "old-token" }));
    mockUpdate.mockResolvedValue({ id: "p1", type: "GITHUB", displayName: "Updated", baseUrl: null, createdAt: new Date() });

    const req = makeRequest("PATCH", {
      displayName: "Updated",
      changeCredentials: true,
      credentials: { token: "new-token" },
    }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(200);
    // encryptedCredentials must have been updated
    expect(mockEncrypt).toHaveBeenCalled();
  });

  it("returns 422 when connection test fails", async () => {
    const { GitHubAdapter } = jest.requireMock("@/services/issue-provider/github");
    GitHubAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockRejectedValue(new Error("Unauthorized")),
    }));

    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "GITHUB", encryptedCredentials: "enc", baseUrl: null });
    mockDecrypt.mockReturnValue(JSON.stringify({ token: "old-token" }));

    const req = makeRequest("PATCH", { displayName: "X", changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(422);
  });

  it("returns errorDetails in 422 response when connection test fails with axios error", async () => {
    const { GitHubAdapter } = jest.requireMock("@/services/issue-provider/github");
    const axiosError = Object.assign(new Error("Unauthorized"), {
      isAxiosError: true,
      response: { status: 401, data: { message: "Bad credentials" }, statusText: "Unauthorized" },
    });
    GitHubAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockRejectedValue(axiosError),
    }));

    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "GITHUB", encryptedCredentials: "enc", baseUrl: null });
    mockDecrypt.mockReturnValue(JSON.stringify({ token: "old-token" }));

    const req = makeRequest("PATCH", { displayName: "X", changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("CONNECTION_TEST_FAILED");
    expect(json.errorDetails).toBeDefined();
    expect(json.errorDetails.cause).toBe("AUTHENTICATION");
    expect(json.errorDetails.statusCode).toBe(401);
  });

  it("strips baseUrl from credentials before encrypting on PATCH (Jira)", async () => {
    const { JiraAdapter } = jest.requireMock("@/services/issue-provider/jira");
    JiraAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    }));

    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "JIRA", encryptedCredentials: "enc", baseUrl: "https://old.atlassian.net" });
    mockUpdate.mockResolvedValue({ id: "p1", type: "JIRA", displayName: "Updated Jira", baseUrl: "https://new.atlassian.net", createdAt: new Date() });

    const req = makeRequest("PATCH", {
      displayName: "Updated Jira",
      baseUrl: "https://new.atlassian.net",
      changeCredentials: true,
      credentials: { email: "u@example.com", apiToken: "tok", baseUrl: "https://new.atlassian.net" },
    }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(200);
    // encrypt must be called with credentials that do NOT contain baseUrl
    const encryptedArg = mockEncrypt.mock.calls[0][0];
    const parsed = JSON.parse(encryptedArg);
    expect(parsed).not.toHaveProperty("baseUrl");
    expect(parsed).toEqual({ email: "u@example.com", apiToken: "tok" });
  });

  it("strips baseUrl from credentials before encrypting on PATCH (Redmine)", async () => {
    const { RedmineAdapter } = jest.requireMock("@/services/issue-provider/redmine");
    RedmineAdapter.mockImplementationOnce(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    }));

    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "REDMINE", encryptedCredentials: "enc", baseUrl: "https://old.redmine.org" });
    mockUpdate.mockResolvedValue({ id: "p1", type: "REDMINE", displayName: "Updated Redmine", baseUrl: "https://new.redmine.org", createdAt: new Date() });

    const req = makeRequest("PATCH", {
      displayName: "Updated Redmine",
      baseUrl: "https://new.redmine.org",
      changeCredentials: true,
      credentials: { apiKey: "key123", baseUrl: "https://new.redmine.org" },
    }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(200);
    const encryptedArg = mockEncrypt.mock.calls[0][0];
    const parsed = JSON.parse(encryptedArg);
    expect(parsed).not.toHaveProperty("baseUrl");
    expect(parsed).toEqual({ apiKey: "key123" });
  });

  it("returns 500 when decrypt fails on PATCH without changeCredentials", async () => {
    mockDecrypt.mockImplementation(() => {
      throw new Error("Decryption failed: invalid key");
    });
    mockFindFirst.mockResolvedValue({ id: "p1", userId: "user-1", type: "GITHUB", encryptedCredentials: "enc", baseUrl: null });

    const req = makeRequest("PATCH", { displayName: "X", changeCredentials: false }, "http://localhost/api/providers/p1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("CREDENTIALS_DECRYPT_FAILED");
  });
});
