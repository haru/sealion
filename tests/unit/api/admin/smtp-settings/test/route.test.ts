/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/smtp-mailer", () => ({
  SMTP_DUMMY_PASSWORD: "__SEALION_DUMMY_SMTP_PASSWORD__",
  sendMail: jest.fn(),
}));
jest.mock("@/lib/smtp-settings", () => ({
  getSmtpSettings: jest.fn(),
}));
jest.mock("@/lib/encryption", () => ({
  encrypt: jest.fn((v: string) => `encrypted:${v}`),
  decrypt: jest.fn((v: string) => v.replace("encrypted:", "")),
}));

import { auth } from "@/lib/auth";
import { sendMail, SMTP_DUMMY_PASSWORD } from "@/lib/smtp-mailer";
import { getSmtpSettings } from "@/lib/smtp-settings";
import { decrypt } from "@/lib/encryption";

const mockAuth = auth as jest.Mock;
const mockSendMail = sendMail as jest.Mock;
const mockGetSmtpSettings = getSmtpSettings as jest.Mock;
const mockDecrypt = decrypt as jest.Mock;

const ADMIN_SESSION = { user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" } };
const USER_SESSION  = { user: { id: "user-1",  email: "user@example.com",  role: "USER"  } };

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

function makePostRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/smtp-settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── POST /api/admin/smtp-settings/test ──────────────────────────────────────

describe("POST /api/admin/smtp-settings/test", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    const res = await POST(makePostRequest(VALID_PAYLOAD));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    const res = await POST(makePostRequest(VALID_PAYLOAD));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    const res = await POST(makePostRequest({ host: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when admin user has no email", async () => {
    mockAuth.mockResolvedValue({ user: { id: "no-email", email: null, role: "ADMIN" } });
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    const res = await POST(makePostRequest(VALID_PAYLOAD));
    expect(res.status).toBe(400);
  });

  it("sends test email and returns 200 on success", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockSendMail.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    const res = await POST(makePostRequest(VALID_PAYLOAD));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.sent).toBe(true);
  });

  it("sends test email to the logged-in admin's email address", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockSendMail.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    await POST(makePostRequest(VALID_PAYLOAD));
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin@example.com" })
    );
  });

  it("returns 422 with error message when sendMail throws", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockSendMail.mockRejectedValue(new Error("Connection refused"));
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    const res = await POST(makePostRequest(VALID_PAYLOAD));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toContain("Connection refused");
  });

  it("returns 422 with string error when non-Error is thrown", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockSendMail.mockRejectedValue("something went wrong");
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    const res = await POST(makePostRequest(VALID_PAYLOAD));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toContain("something went wrong");
  });

  it("uses plain password directly when not dummy sentinel", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockSendMail.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    await POST(makePostRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "u@ex.com", password: "directpassword" }));
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ password: "directpassword" })
    );
  });

  it("decrypts stored password when dummy sentinel is sent", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockGetSmtpSettings.mockResolvedValue({ encryptedPassword: "encrypted:storedpassword" });
    mockDecrypt.mockReturnValue("storedpassword");
    mockSendMail.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    await POST(makePostRequest({ ...VALID_PAYLOAD, requireAuth: true, username: "u@ex.com", password: SMTP_DUMMY_PASSWORD }));
    expect(mockDecrypt).toHaveBeenCalledWith("encrypted:storedpassword");
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ password: "storedpassword" })
    );
  });

  it("uses null password when dummy sentinel sent but no stored settings", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockGetSmtpSettings.mockResolvedValue(null);
    mockSendMail.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    await POST(makePostRequest({ ...VALID_PAYLOAD, password: SMTP_DUMMY_PASSWORD }));
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ password: null })
    );
  });

  it("uses null password when dummy sentinel sent but stored settings have no password", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockGetSmtpSettings.mockResolvedValue({ encryptedPassword: null });
    mockSendMail.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/admin/smtp-settings/test/route");
    await POST(makePostRequest({ ...VALID_PAYLOAD, password: SMTP_DUMMY_PASSWORD }));
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ password: null })
    );
  });
});
