/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    project: {
      update: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PATCH } from "@/app/api/projects/[id]/route";

const mockAuth = auth as jest.Mock;
const mockUpdate = prisma.project.update as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@ex.com", role: "USER" } };

type Params = { params: Promise<{ id: string }> };

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/projects/proj-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "proj-1"): Params {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ includeUnassigned: true }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 when includeUnassigned is not a boolean", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const res = await PATCH(makeRequest({ includeUnassigned: "yes" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when includeUnassigned is missing", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const res = await PATCH(makeRequest({}), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 403 when project is not found or not owned by user", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const notFoundError = Object.assign(new Error("Not found"), { code: "P2025" });
    mockUpdate.mockRejectedValue(notFoundError);

    const res = await PATCH(makeRequest({ includeUnassigned: true }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 200 with updated project when valid", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockUpdate.mockResolvedValue({ id: "proj-1", includeUnassigned: true });

    const res = await PATCH(makeRequest({ includeUnassigned: true }), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe("proj-1");
    expect(json.data.includeUnassigned).toBe(true);
  });

  it("sets includeUnassigned to false when toggling off", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockUpdate.mockResolvedValue({ id: "proj-1", includeUnassigned: false });

    const res = await PATCH(makeRequest({ includeUnassigned: false }), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.includeUnassigned).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { includeUnassigned: false },
      })
    );
  });

  it("enforces ownership via where clause in single atomic update", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockUpdate.mockResolvedValue({ id: "proj-1", includeUnassigned: true });

    await PATCH(makeRequest({ includeUnassigned: true }), makeParams());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "proj-1",
          issueProvider: { userId: "user-1" },
        }),
      })
    );
  });
});
