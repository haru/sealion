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
  jest.doMock("@/lib/db", () => ({ prisma }));
  // Import the route handler after setting up the mock.
  return await import("@/app/api/providers/route");
}

const TEST_USER_ID = "integration-test-user";
const VALID_KEY = "a".repeat(64);

// Set environment variables before importing modules
process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;

// Mock the session - use real Prisma but mock auth
jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: "test@integration.com", role: "USER" },
  }),
}));

// Mock the GitHub adapter to avoid real network calls
jest.mock("@/services/issue-provider/github", () => ({
  GitHubAdapter: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(undefined),
  })),
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
});
