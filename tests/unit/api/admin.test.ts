/** @jest-environment node */
import { GET } from "@/app/api/admin/users/route";
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
prisma.user.create as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;

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
