/** @jest-environment node */
/**
 * Integration tests for:
 *   GET  /api/admin/smtp-settings
 *   PUT  /api/admin/smtp-settings
 *   POST /api/admin/smtp-settings/test
 *
 * Uses a real Prisma client against the test database.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to the test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({ auth: jest.fn() }));

import { auth } from "@/lib/auth/auth";
const mockAuth = auth as jest.Mock;

const ADMIN_SESSION = { user: { id: "int-admin-smtp-1", email: "admin@smtp.test", role: "ADMIN" } };
const USER_SESSION  = { user: { id: "int-user-smtp-1",  email: "user@smtp.test",  role: "USER"  } };

let prismaClient: PrismaClient;
let dbAvailable = false;

async function importSettingsRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth/auth", () => ({ auth: mockAuth }));
  return await import("@/app/api/admin/smtp-settings/route");
}

async function importTestRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth/auth", () => ({ auth: mockAuth }));
  return await import("@/app/api/admin/smtp-settings/test/route");
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/smtp-settings");
}

function makePutRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/smtp-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePostTestRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/smtp-settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  host: "smtp.example.com",
  port: 587,
  fromAddress: "noreply@example.com",
  fromName: "Sealion",
  requireAuth: false,
  username: null,
  password: null,
  useTls: false,
};

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping smtp-settings integration tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prismaClient = new PrismaClient({ adapter });
    await prismaClient.$connect();
    dbAvailable = true;

    await prismaClient.smtpSettings.deleteMany({ where: { id: "singleton" } });
  } catch (err) {
    console.warn("DB unavailable — skipping smtp-settings integration tests", err);
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prismaClient.smtpSettings.deleteMany({ where: { id: "singleton" } });
    await prismaClient.$disconnect();
  }
});

// ─── GET /api/admin/smtp-settings ──────────────────────────────────────────

describe("GET /api/admin/smtp-settings (integration)", () => {
  afterEach(async () => {
    if (dbAvailable) {
      await prismaClient.smtpSettings.deleteMany({ where: { id: "singleton" } });
    }
  });

  it("returns null when no record exists", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { GET } = await importSettingsRoute(prismaClient);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toBeNull();
  });

  it("returns settings without encryptedPassword when record exists", async () => {
    if (!dbAvailable) return;

    await prismaClient.smtpSettings.create({
      data: {
        id: "singleton",
        host: "smtp.example.com",
        port: 587,
        fromAddress: "noreply@example.com",
        fromName: "Sealion",
        requireAuth: true,
        username: "user@example.com",
        encryptedPassword: "iv:tag:ciphertext",
        useTls: false,
      },
    });

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { GET } = await importSettingsRoute(prismaClient);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).not.toBeNull();
    expect(json.data).not.toHaveProperty("encryptedPassword");
    expect(json.data.hasPassword).toBe(true);
    expect(json.data.host).toBe("smtp.example.com");
    expect(json.data.requireAuth).toBe(true);
    expect(json.data.username).toBe("user@example.com");
  });

  it("returns hasPassword:false when encryptedPassword is null", async () => {
    if (!dbAvailable) return;

    await prismaClient.smtpSettings.create({
      data: {
        id: "singleton",
        host: "smtp.example.com",
        port: 587,
        fromAddress: "noreply@example.com",
        fromName: "Sealion",
        requireAuth: false,
        useTls: false,
      },
    });

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { GET } = await importSettingsRoute(prismaClient);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.hasPassword).toBe(false);
  });

  it("returns 403 for non-admin", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(USER_SESSION);
    const { GET } = await importSettingsRoute(prismaClient);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });
});

// ─── PUT /api/admin/smtp-settings ──────────────────────────────────────────

describe("PUT /api/admin/smtp-settings (integration)", () => {
  afterEach(async () => {
    if (dbAvailable) {
      await prismaClient.smtpSettings.deleteMany({ where: { id: "singleton" } });
    }
  });

  it("upserts record and returns SmtpSettingsResponse", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await importSettingsRoute(prismaClient);

    const res = await PUT(makePutRequest(VALID_PAYLOAD));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.host).toBe("smtp.example.com");
    expect(json.data.port).toBe(587);
    expect(json.data.fromAddress).toBe("noreply@example.com");
    expect(json.data.fromName).toBe("Sealion");
    expect(json.data.hasPassword).toBe(false);
    expect(json.data).not.toHaveProperty("encryptedPassword");

    const row = await prismaClient.smtpSettings.findUnique({ where: { id: "singleton" } });
    expect(row).not.toBeNull();
  });

  it("PUT with new password encrypts and stores it", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await importSettingsRoute(prismaClient);

    const res = await PUT(makePutRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "user@example.com", password: "mysecretpassword" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.hasPassword).toBe(true);

    const row = await prismaClient.smtpSettings.findUnique({ where: { id: "singleton" } });
    expect(row?.encryptedPassword).not.toBeNull();
    expect(row?.encryptedPassword).not.toBe("mysecretpassword");
  });

  it("PUT with dummy password keeps existing encryptedPassword", async () => {
    if (!dbAvailable) return;

    const existingPassword = "existing:encrypted:value";
    await prismaClient.smtpSettings.create({
      data: {
        id: "singleton",
        host: "old.smtp.com",
        port: 25,
        fromAddress: "old@example.com",
        fromName: "Old",
        requireAuth: true,
        username: "user@example.com",
        encryptedPassword: existingPassword,
        useTls: false,
      },
    });

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await importSettingsRoute(prismaClient);

    const { SMTP_DUMMY_PASSWORD } = await import("@/lib/email/smtp-mailer");
    const res = await PUT(makePutRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "user@example.com", password: SMTP_DUMMY_PASSWORD }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.hasPassword).toBe(true);

    const row = await prismaClient.smtpSettings.findUnique({ where: { id: "singleton" } });
    expect(row?.encryptedPassword).toBe(existingPassword);
  });

  it("returns 400 for invalid payload", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await importSettingsRoute(prismaClient);

    const res = await PUT(makePutRequest({ host: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-admin", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(USER_SESSION);
    const { PUT } = await importSettingsRoute(prismaClient);

    const res = await PUT(makePutRequest(VALID_PAYLOAD));
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/admin/smtp-settings/test ────────────────────────────────────

describe("POST /api/admin/smtp-settings/test (integration)", () => {
  afterEach(async () => {
    if (dbAvailable) {
      await prismaClient.smtpSettings.deleteMany({ where: { id: "singleton" } });
    }
  });

  it("returns 403 for non-admin", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(USER_SESSION);
    const { POST } = await importTestRoute(prismaClient);

    const res = await POST(makePostTestRequest(VALID_PAYLOAD));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid payload", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { POST } = await importTestRoute(prismaClient);

    const res = await POST(makePostTestRequest({ host: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when admin user has no email", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue({ user: { id: "no-email-admin", email: null, role: "ADMIN" } });
    const { POST } = await importTestRoute(prismaClient);

    const res = await POST(makePostTestRequest(VALID_PAYLOAD));
    expect(res.status).toBe(400);
  });

  it("returns 422 with SMTP error message when transport fails", async () => {
    if (!dbAvailable) return;

    jest.doMock("@/lib/email/smtp-mailer", () => ({
      SMTP_DUMMY_PASSWORD: "__SEALION_DUMMY_SMTP_PASSWORD__",
      sendMail: jest.fn().mockRejectedValue(new Error("Connection refused")),
    }));

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { POST } = await importTestRoute(prismaClient);

    const res = await POST(makePostTestRequest(VALID_PAYLOAD));
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toContain("Connection refused");
  });

  it("POST with dummy password fetches and decrypts existing password from DB", async () => {
    if (!dbAvailable) return;

    // Create a record with a known encrypted password
    const plainPassword = "secretpassword";
    const { encrypt } = await import("@/lib/encryption/encryption");
    const encryptedPw = encrypt(plainPassword);

    await prismaClient.smtpSettings.create({
      data: {
        id: "singleton",
        host: "smtp.example.com",
        port: 587,
        fromAddress: "noreply@example.com",
        fromName: "Sealion",
        requireAuth: true,
        username: "user@example.com",
        encryptedPassword: encryptedPw,
        useTls: false,
      },
    });

    const capturedConfig: Record<string, unknown>[] = [];
    jest.doMock("@/lib/email/smtp-mailer", () => ({
      SMTP_DUMMY_PASSWORD: "__SEALION_DUMMY_SMTP_PASSWORD__",
      sendMail: jest.fn().mockImplementation((cfg: Record<string, unknown>) => {
        capturedConfig.push(cfg);
        return Promise.resolve();
      }),
    }));

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { POST } = await importTestRoute(prismaClient);

    const { SMTP_DUMMY_PASSWORD } = await import("@/lib/email/smtp-mailer");
    const res = await POST(makePostTestRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "user@example.com", password: SMTP_DUMMY_PASSWORD }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.sent).toBe(true);
    expect(capturedConfig[0]?.password).toBe(plainPassword);
  });

  it("POST with real password uses it directly", async () => {
    if (!dbAvailable) return;

    const capturedConfig: Record<string, unknown>[] = [];
    jest.doMock("@/lib/email/smtp-mailer", () => ({
      SMTP_DUMMY_PASSWORD: "__SEALION_DUMMY_SMTP_PASSWORD__",
      sendMail: jest.fn().mockImplementation((cfg: Record<string, unknown>) => {
        capturedConfig.push(cfg);
        return Promise.resolve();
      }),
    }));

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { POST } = await importTestRoute(prismaClient);

    const res = await POST(makePostTestRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "user@example.com", password: "directpassword" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.sent).toBe(true);
    expect(capturedConfig[0]?.password).toBe("directpassword");
  });

  it("POST sends test email to logged-in user's email", async () => {
    if (!dbAvailable) return;

    const capturedConfig: Record<string, unknown>[] = [];
    jest.doMock("@/lib/email/smtp-mailer", () => ({
      SMTP_DUMMY_PASSWORD: "__SEALION_DUMMY_SMTP_PASSWORD__",
      sendMail: jest.fn().mockImplementation((cfg: Record<string, unknown>) => {
        capturedConfig.push(cfg);
        return Promise.resolve();
      }),
    }));

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { POST } = await importTestRoute(prismaClient);

    await POST(makePostTestRequest(VALID_PAYLOAD));

    expect(capturedConfig[0]?.to).toBe("admin@smtp.test");
  });
});
