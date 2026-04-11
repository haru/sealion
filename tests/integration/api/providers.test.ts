/** @jest-environment node */
/**
 * Integration test: Provider registration cycle (POST → GET → DELETE)
 * Uses real Prisma against test database.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to test DB
 *   - CREDENTIALS_ENCRYPTION_KEY set (32-byte hex string)
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

// Helper to import the providers route with a mocked Prisma client.
async function importProvidersRouteWithPrisma(prisma: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db/db", () => ({ prisma }));
  // Import the route handler after setting up the mock.
  return await import("@/app/api/providers/route");
}

// Helper to import the [id] route with a mocked Prisma client.
async function importProviderIdRouteWithPrisma(prisma: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db/db", () => ({ prisma }));
  return await import("@/app/api/providers/[id]/route");
}

const TEST_USER_ID = "integration-test-user";
const VALID_KEY = "a".repeat(64);

// Set environment variables before importing modules
process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;

// Mock the session - use real Prisma but mock auth
jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: "test@integration.com", role: "USER" },
  }),
}));

// Mock adapters to avoid real network calls (include static iconUrl)
jest.mock("@/services/issue-provider/github/github", () => ({
  GitHubAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/providers/github.svg" }
  ),
}));

jest.mock("@/services/issue-provider/jira/jira", () => ({
  JiraAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/providers/jira.svg" }
  ),
}));

jest.mock("@/services/issue-provider/redmine/redmine", () => ({
  RedmineAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/providers/redmine.svg" }
  ),
}));

jest.mock("@/services/issue-provider/linear/linear", () => ({
  LinearAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/providers/linear.svg" }
  ),
}));

jest.mock("@/services/issue-provider/asana/asana", () => ({
  AsanaAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/providers/asana.svg" }
  ),
}));

jest.mock("@/services/issue-provider/backlog/backlog", () => ({
  BacklogAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      testConnection: jest.fn().mockResolvedValue(undefined),
    })),
    { iconUrl: "/providers/backlog.svg" }
  ),
}));

let prisma: PrismaClient;
let dbAvailable = false;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping integration tests");
    return;
  }
  try {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });

    // Create test user if it doesn't exist
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: "test@integration.com",
        passwordHash: "hashed",
        role: "USER",
      },
    });
    dbAvailable = true;
  } catch {
    console.warn("Database unavailable — skipping integration tests");
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
});

afterAll(async () => {
  if (!prisma || !dbAvailable) return;
  // Clean up test data
  await prisma.issueProvider.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.$disconnect();
});

describe("Provider registration cycle (Integration)", () => {
  const skipIfNoDB = () => {
    if (!dbAvailable) {
      console.warn("Skipping: database unavailable");
      return true;
    }
    return false;
  };

  it("POST → GET → DELETE cycle with real Prisma", async () => {
    if (skipIfNoDB()) return;

    const { GET, POST } = await importProvidersRouteWithPrisma(prisma);
    const { DELETE } = await import("@/app/api/providers/[id]/route");

    // POST: Create provider
    const postReq = new NextRequest("http://localhost/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "GITHUB",
        displayName: "Integration Test GitHub",
        credentials: { token: "ghp_test_integration" },
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    const providerId = postJson.data.id;
    expect(providerId).toBeTruthy();

    // GET: List providers
    const getReq = new NextRequest("http://localhost/api/providers");
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.some((p: { id: string }) => p.id === providerId)).toBe(true);

    // DELETE: Remove provider
    const deleteReq = new NextRequest(`http://localhost/api/providers/${providerId}`, {
      method: "DELETE",
    });
    const deleteRes = await DELETE(deleteReq, { params: Promise.resolve({ id: providerId }) });
    expect(deleteRes.status).toBe(200);

    // Verify it's gone
    const afterDeleteRes = await GET(new NextRequest("http://localhost/api/providers"));
    const afterDeleteJson = await afterDeleteRes.json();
    expect(afterDeleteJson.data.some((p: { id: string }) => p.id === providerId)).toBe(false);
  });

  // T004: POST baseUrl storage — Jira baseUrl is stored in DB field, not in encryptedCredentials
  it("T004: POST Jira stores baseUrl in DB field with real Prisma", async () => {
    if (skipIfNoDB()) return;

    const { GET, POST } = await importProvidersRouteWithPrisma(prisma);

    const postReq = new NextRequest("http://localhost/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "JIRA",
        displayName: "Integration Test Jira",
        credentials: {
          baseUrl: "https://integration-test.atlassian.net",
          email: "user@example.com",
          apiToken: "test-token",
        },
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    const providerId = postJson.data.id;

    // Verify DB state directly
    const dbProvider = await prisma.issueProvider.findUnique({ where: { id: providerId } });
    expect(dbProvider?.baseUrl).toBe("https://integration-test.atlassian.net");

    // encryptedCredentials must not contain baseUrl
    const { decrypt } = await import("@/lib/encryption/encryption");
    const decrypted = JSON.parse(decrypt(dbProvider!.encryptedCredentials));
    expect(decrypted).not.toHaveProperty("baseUrl");
    expect(decrypted).toHaveProperty("email", "user@example.com");

    // GET response also includes baseUrl
    const getRes = await GET(new NextRequest("http://localhost/api/providers"));
    const getJson = await getRes.json();
    const found = getJson.data.find((p: { id: string }) => p.id === providerId);
    expect(found?.baseUrl).toBe("https://integration-test.atlassian.net");

    // Cleanup
    await prisma.issueProvider.delete({ where: { id: providerId } });
  });

  // T009: PATCH update cycle with real Prisma
  it("T009: PATCH updates provider name and URL", async () => {
    if (skipIfNoDB()) return;

    const { POST } = await importProvidersRouteWithPrisma(prisma);

    // Create a GitHub provider first
    const postReq = new NextRequest("http://localhost/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "GITHUB",
        displayName: "PATCH Test GitHub",
        credentials: { token: "ghp_patch_test" },
      }),
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const providerId = (await postRes.json()).data.id;

    // PATCH: update displayName
    const { PATCH } = await importProviderIdRouteWithPrisma(prisma);
    const patchReq = new NextRequest(`http://localhost/api/providers/${providerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Updated GitHub", changeCredentials: false }),
    });
    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: providerId }) });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.data.displayName).toBe("Updated GitHub");

    // Verify in DB
    const dbProvider = await prisma.issueProvider.findUnique({ where: { id: providerId } });
    expect(dbProvider?.displayName).toBe("Updated GitHub");

    // Cleanup
    await prisma.issueProvider.delete({ where: { id: providerId } });
  });

  // T014: GET returns baseUrl
  it("T014: GET /api/providers returns baseUrl field", async () => {
    if (skipIfNoDB()) return;

    const { GET, POST } = await importProvidersRouteWithPrisma(prisma);

    // Create Jira provider
    const postReq = new NextRequest("http://localhost/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "JIRA",
        displayName: "GET baseUrl Test Jira",
        credentials: {
          baseUrl: "https://get-test.atlassian.net",
          email: "user@example.com",
          apiToken: "test-token",
        },
      }),
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const providerId = (await postRes.json()).data.id;

    // GET: verify baseUrl is in response
    const getRes = await GET(new NextRequest("http://localhost/api/providers"));
    const getJson = await getRes.json();
    const found = getJson.data.find((p: { id: string }) => p.id === providerId);
    expect(found).toBeDefined();
    expect(found?.baseUrl).toBe("https://get-test.atlassian.net");

    // Cleanup
    await prisma.issueProvider.delete({ where: { id: providerId } });
  });

  // T015: POST /api/providers creates provider with type string (not enum) after enum removal
  it("T015: POST creates provider with arbitrary type string after ProviderType enum removal", async () => {
    if (skipIfNoDB()) return;

    const { GET, POST } = await importProvidersRouteWithPrisma(prisma);

    const postReq = new NextRequest("http://localhost/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "GITHUB",
        displayName: "String Type Test",
        credentials: { token: "ghp_string_type" },
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.data.type).toBe("GITHUB");
    const providerId = postJson.data.id;

    // Verify directly in DB that type is stored as text
    const dbProvider = await prisma.issueProvider.findUnique({ where: { id: providerId } });
    expect(dbProvider?.type).toBe("GITHUB");

    // Cleanup
    await prisma.issueProvider.delete({ where: { id: providerId } });
  });

  // T016: GET /api/providers returns providers with correct type strings after schema change
  it("T016: GET returns providers with correct type strings after enum removal", async () => {
    if (skipIfNoDB()) return;

    const { GET, POST } = await importProvidersRouteWithPrisma(prisma);

    // Create multiple providers with different types
    for (const type of ["GITHUB", "JIRA", "REDMINE", "GITLAB", "LINEAR", "ASANA", "BACKLOG"]) {
      const postReq = new NextRequest("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          displayName: `Type Test ${type}`,
          credentials:
        type === "GITHUB" || type === "GITLAB" || type === "ASANA"
          ? { token: `tok_${type.toLowerCase()}` }
          : type === "LINEAR"
            ? { apiKey: `lin_${type.toLowerCase()}` }
            : type === "REDMINE"
              ? {
                  baseUrl: `https://${type.toLowerCase()}.example.com`,
                  apiKey: `key_${type.toLowerCase()}`,
                }
              : type === "BACKLOG"
                ? {
                    baseUrl: `https://${type.toLowerCase()}.backlog.com`,
                    apiKey: `key_${type.toLowerCase()}`,
                  }
                : {
                    baseUrl: `https://${type.toLowerCase()}.example.com`,
                    email: "u@example.com",
                    apiToken: "tok",
                  },
        }),
      });
      const res = await POST(postReq);
      expect(res.status).toBe(201);
    }

    // GET all providers and verify type strings
    const getRes = await GET(new NextRequest("http://localhost/api/providers"));
    const getJson = await getRes.json();
    expect(getRes.status).toBe(200);

    const testProviders = getJson.data.filter(
      (p: { displayName: string }) => p.displayName.startsWith("Type Test "),
    );
    expect(testProviders.length).toBe(7);

    for (const provider of testProviders) {
      const typeFromName = provider.displayName.replace("Type Test ", "");
      expect(provider.type).toBe(typeFromName);
    }

    // Cleanup
    for (const provider of testProviders) {
      await prisma.issueProvider.delete({ where: { id: provider.id } });
    }
  });
});
