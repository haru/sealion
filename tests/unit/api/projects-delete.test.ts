/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    project: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DELETE } from "@/app/api/projects/[id]/route";

const mockAuth = auth as jest.Mock;
const mockFindFirst = prisma.project.findFirst as jest.Mock;
const mockDelete = prisma.project.delete as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@ex.com", role: "USER" } };

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/projects/proj-1", { method: "DELETE" });
}

describe("DELETE /api/projects/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when project belongs to another user (userId-scoped lookup returns null)", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "proj-other" }) });
    expect(res.status).toBe(404);
  });

  it("returns 204 and deletes project when valid", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "proj-1", issueProviderId: "p1" });
    mockDelete.mockResolvedValue({});

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "proj-1" } });
  });
});
