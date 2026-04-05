/** @jest-environment node */
import { GET, POST } from "@/app/api/admin/users/route";
import { PATCH, DELETE } from "@/app/api/admin/users/[id]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    issue: { deleteMany: jest.fn() },
    project: { deleteMany: jest.fn() },
    issueProvider: { deleteMany: jest.fn() },
    boardSettings: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed") }));

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

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
    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "short", username: "John" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
  });

  it("returns 400 MISSING_USERNAME when username is not provided", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("MISSING_USERNAME");
  });

  it("returns 409 when email already exists", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "existing", email: "new@ex.com" });
    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123", username: "John" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("creates user with USER role by default", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-1", email: "new@ex.com", role: "USER", createdAt: new Date() });

    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123", username: "John" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.email).toBe("new@ex.com");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "USER" }) })
    );
  });

  it("passes username to user create when provided", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-4", email: "new@ex.com", role: "USER", createdAt: new Date() });

    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123", username: "John Doe" }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ username: "John Doe" }) })
    );
  });

  it("creates user with ADMIN role when specified", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-2", email: "admin2@ex.com", role: "ADMIN", createdAt: new Date() });

    const res = await POST(makeRequest("POST", { email: "admin2@ex.com", password: "password123", role: "ADMIN", username: "Admin2" }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) })
    );
  });

  it("ignores invalid role and defaults to USER", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-3", email: "new@ex.com", role: "USER", createdAt: new Date() });

    const res = await POST(makeRequest("POST", { email: "new@ex.com", password: "password123", role: "SUPERADMIN", username: "John" }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "USER" }) })
    );
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when admin tries to change own status", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const req = makeRequest("PATCH", { status: "SUSPENDED" }, "http://localhost/api/admin/users/admin-1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "admin-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("CANNOT_CHANGE_OWN_STATUS");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 200 when admin updates another user's status", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });
    mockUpdate.mockResolvedValue({ id: "user-2", status: "SUSPENDED" });

    const req = makeRequest("PATCH", { status: "SUSPENDED" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(200);
  });

  it("returns 403 when non-admin tries to update", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);

    const req = makeRequest("PATCH", { status: "SUSPENDED" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(403);
  });

  it("returns 403 CANNOT_CHANGE_OWN_ROLE when admin tries to change their own role", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "admin-1", email: "admin@ex.com", role: "ADMIN" });

    const req = makeRequest("PATCH", { role: "USER" }, "http://localhost/api/admin/users/admin-1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "admin-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("CANNOT_CHANGE_OWN_ROLE");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows admin to update own non-role fields (email/username/password)", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "admin-1", email: "admin@ex.com", role: "ADMIN" });
    mockUpdate.mockResolvedValue({ id: "admin-1", email: "new@ex.com", role: "ADMIN", status: "ACTIVE" });

    const req = makeRequest("PATCH", { username: "New Name" }, "http://localhost/api/admin/users/admin-1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "admin-1" }) });

    expect(res.status).toBe(200);
  });

  it("returns 404 when target user does not exist", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);

    const req = makeRequest("PATCH", { username: "X" }, "http://localhost/api/admin/users/no-such");
    const res = await PATCH(req, { params: Promise.resolve({ id: "no-such" }) });

    expect(res.status).toBe(404);
  });

  it("returns 400 PASSWORD_TOO_LONG when password exceeds 72 characters", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });

    const longPassword = "a".repeat(73);
    const req = makeRequest("PATCH", { password: longPassword }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_LONG");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows PATCH when admin sends own current role (no actual role change)", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "admin-1", email: "admin@ex.com", role: "ADMIN" });
    mockUpdate.mockResolvedValue({ id: "admin-1", email: "admin@ex.com", role: "ADMIN", status: "ACTIVE" });

    // Sending role=ADMIN when current role is ADMIN — should NOT be blocked
    const req = makeRequest("PATCH", { username: "New Name", role: "ADMIN" }, "http://localhost/api/admin/users/admin-1");
    const res = await PATCH(req, { params: Promise.resolve({ id: "admin-1" }) });

    expect(res.status).toBe(200);
  });

  it("returns 409 EMAIL_ALREADY_EXISTS when PATCH triggers Prisma P2002 constraint error", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });

    const prismaError = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockUpdate.mockRejectedValue(prismaError);

    const req = makeRequest("PATCH", { email: "taken@ex.com" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("returns 500 INTERNAL_ERROR when PATCH throws unexpected error", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });
    mockUpdate.mockRejectedValue(new Error("unexpected db error"));

    const req = makeRequest("PATCH", { username: "X" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("INTERNAL_ERROR");
  });

  it("ignores password when changePassword is absent even if password has a value", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });
    mockUpdate.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER", status: "ACTIVE" });

    const req = makeRequest("PATCH", { username: "New Name", password: "newpassword123" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(200);
    const updateArgs = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).not.toHaveProperty("passwordHash");
  });

  it("ignores password when changePassword is false even if password has a value", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });
    mockUpdate.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER", status: "ACTIVE" });

    const req = makeRequest("PATCH", { changePassword: false, password: "newpassword123" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(200);
    const updateArgs = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).not.toHaveProperty("passwordHash");
  });

  it("updates password when changePassword is true and password is valid", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });
    mockUpdate.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER", status: "ACTIVE" });

    const req = makeRequest("PATCH", { changePassword: true, password: "newpassword123" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(200);
    const updateArgs = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).toHaveProperty("passwordHash", "hashed");
  });

  it("returns 400 PASSWORD_REQUIRED when changePassword is true but password is missing", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });

    const req = makeRequest("PATCH", { changePassword: true }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_REQUIRED");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 PASSWORD_TOO_SHORT when changePassword is true and password is less than 8 chars", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com", role: "USER" });

    const req = makeRequest("PATCH", { changePassword: true, password: "short" }, "http://localhost/api/admin/users/user-2");
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-2" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  const mockTransaction = prisma.$transaction as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRequest("DELETE", undefined, "http://localhost/api/admin/users/user-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "user-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin tries to delete", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const req = makeRequest("DELETE", undefined, "http://localhost/api/admin/users/user-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "user-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 CANNOT_DELETE_SELF when admin tries to delete own account", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const req = makeRequest("DELETE", undefined, "http://localhost/api/admin/users/admin-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "admin-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("CANNOT_DELETE_SELF");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 404 when target user does not exist", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue(null);

    const req = makeRequest("DELETE", undefined, "http://localhost/api/admin/users/no-such");
    const res = await DELETE(req, { params: Promise.resolve({ id: "no-such" }) });

    expect(res.status).toBe(404);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 200 and calls transaction cascade delete for valid target", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "u@ex.com" });
    mockTransaction.mockResolvedValue([]);

    const req = makeRequest("DELETE", undefined, "http://localhost/api/admin/users/user-2");
    const res = await DELETE(req, { params: Promise.resolve({ id: "user-2" }) });

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
