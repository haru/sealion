/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    smtpSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));
jest.mock("@/lib/encryption", () => ({
  encrypt: jest.fn((v: string) => `encrypted:${v}`),
  decrypt: jest.fn((v: string) => v.replace("encrypted:", "")),
}));
jest.mock("@/lib/smtp-mailer", () => ({
  SMTP_DUMMY_PASSWORD: "__SEALION_DUMMY_SMTP_PASSWORD__",
  sendMail: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

const mockAuth = auth as jest.Mock;
const mockFindUnique = prisma.smtpSettings.findUnique as jest.Mock;
const mockUpsert = prisma.smtpSettings.upsert as jest.Mock;
const mockEncrypt = encrypt as jest.Mock;

const ADMIN_SESSION = { user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" } };
const USER_SESSION  = { user: { id: "user-1",  email: "user@example.com",  role: "USER"  } };

const BASE_SETTINGS = {
  id: "singleton",
  host: "smtp.example.com",
  port: 587,
  fromAddress: "noreply@example.com",
  fromName: "Sealion",
  requireAuth: false,
  username: null,
  encryptedPassword: null,
  useTls: false,
};

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

// ─── GET /api/admin/smtp-settings ────────────────────────────────────────────

describe("GET /api/admin/smtp-settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/smtp-settings/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const { GET } = await import("@/app/api/admin/smtp-settings/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns null when no settings exist", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/smtp-settings/route");
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toBeNull();
  });

  it("returns settings with hasPassword:false when no password stored", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ ...BASE_SETTINGS, encryptedPassword: null });
    const { GET } = await import("@/app/api/admin/smtp-settings/route");
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.hasPassword).toBe(false);
    expect(json.data).not.toHaveProperty("encryptedPassword");
  });

  it("returns settings with hasPassword:true when password is stored", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ ...BASE_SETTINGS, encryptedPassword: "iv:tag:ciphertext" });
    const { GET } = await import("@/app/api/admin/smtp-settings/route");
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.hasPassword).toBe(true);
    expect(json.data.host).toBe("smtp.example.com");
    expect(json.data).not.toHaveProperty("encryptedPassword");
  });

  it("returns all expected fields in response", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({
      ...BASE_SETTINGS,
      requireAuth: true,
      username: "user@example.com",
      encryptedPassword: "encrypted",
    });
    const { GET } = await import("@/app/api/admin/smtp-settings/route");
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.data).toMatchObject({
      host: "smtp.example.com",
      port: 587,
      fromAddress: "noreply@example.com",
      fromName: "Sealion",
      requireAuth: true,
      username: "user@example.com",
      hasPassword: true,
      useTls: false,
    });
  });
});

// ─── PUT /api/admin/smtp-settings ────────────────────────────────────────────

describe("PUT /api/admin/smtp-settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest(VALID_PAYLOAD));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest(VALID_PAYLOAD));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest({ host: 123 }));
    expect(res.status).toBe(400);
  });

  it("upserts and returns settings without encryptedPassword field", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ ...BASE_SETTINGS });
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest(VALID_PAYLOAD));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.host).toBe("smtp.example.com");
    expect(json.data).not.toHaveProperty("encryptedPassword");
  });

  it("encrypts and stores new password when provided", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockEncrypt.mockReturnValue("encrypted:newpassword");
    mockUpsert.mockResolvedValue({ ...BASE_SETTINGS, encryptedPassword: "encrypted:newpassword" });
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "u@ex.com", password: "newpassword" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.hasPassword).toBe(true);
    expect(mockEncrypt).toHaveBeenCalledWith("newpassword");
  });

  it("keeps existing encryptedPassword when dummy sentinel is sent", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ ...BASE_SETTINGS, encryptedPassword: "existing:encrypted" });
    mockUpsert.mockResolvedValue({ ...BASE_SETTINGS, encryptedPassword: "existing:encrypted" });
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "u@ex.com", password: "__SEALION_DUMMY_SMTP_PASSWORD__" }));
    expect(res.status).toBe(200);
    expect(mockEncrypt).not.toHaveBeenCalled();
    const callArg = mockUpsert.mock.calls[0][0];
    expect(callArg.update.encryptedPassword).toBe("existing:encrypted");
  });

  it("keeps null when null password and no existing record", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ ...BASE_SETTINGS, encryptedPassword: null });
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest(VALID_PAYLOAD));
    expect(res.status).toBe(200);
    expect(mockEncrypt).not.toHaveBeenCalled();
    const callArg = mockUpsert.mock.calls[0][0];
    expect(callArg.update.encryptedPassword).toBeNull();
  });

  it("returns hasPassword:false when settings have no password", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ ...BASE_SETTINGS, encryptedPassword: null });
    const { PUT } = await import("@/app/api/admin/smtp-settings/route");
    const res = await PUT(makePutRequest(VALID_PAYLOAD));
    const json = await res.json();
    expect(json.data.hasPassword).toBe(false);
  });
});
