/** @jest-environment node */
import { GET, POST } from "@/app/api/admin/users/route";
import { PATCH } from "@/app/api/admin/users/[id]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed") }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.user.findMany as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;

const ADMIN_SESSION = { user: { id: "admin-1", email: "admin@ex.com", role: "ADMIN" } };
const USER_SESSION = { user: { id: "user-1", email: "user@ex.com", role: "USER" } };

function makeRequest(method: string, body?: object, url = "http://localhost/api/admin/users"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/admin/users", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with user list when admin", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindMany.mockResolvedValue([
      { id: "u1", email: "u@ex.com", role: "USER", isActive: true, createdAt: new Date() },
    ]);

    const res = await GET(makeRequest("GET"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/users", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(makeRequest("POST", { password: "password123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(makeRequest("POST", { email: "new@ex.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "short" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
  });

  it("returns 409 when email already exists", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "existing", email: "new@ex.com" });
    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("creates user with USER role by default", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-1", email: "new@ex.com", role: "USER", createdAt: new Date() });

    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.email).toBe("new@ex.com");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "USER" }) })
    );
  });

  it("creates user with ADMIN role when specified", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-2", email: "admin2@ex.com", role: "ADMIN", createdAt: new Date() });

    const res = await POST(makeRequest("POST", { email: "admin2@ex.com", password: "password123", role: "ADMIN" }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) })
    );
  });

  it("ignores invalid role and defaults to USER", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-3", email: "new@ex.com", role: "USER", createdAt: new Date() });

    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123", role: "SUPERADMIN" }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "USER" }) })
    );
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when admin tries to deactivate self", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const req = makeRequest("PATCH", { isActive: false }, "http://localhost/api/admin/users/admin-1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "admin-1" }) });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 200 when admin updates another user", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });
    mockUpdate.mockResolvedValue({ id: "user-2", isActive: false });

    const req = makeRequest("PATCH", { isActive: false }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(200);
  });

  it("returns 403 when non-admin tries to update", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);

    const req = makeRequest("PATCH", { isActive: false }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(403);
  });
});
