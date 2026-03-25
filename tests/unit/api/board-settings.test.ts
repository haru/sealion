/** @jest-environment node */
import { GET, PUT } from "@/app/api/board-settings/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: { boardSettings: { findUnique: jest.fn(), upsert: jest.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindUnique = prisma.boardSettings.findUnique as jest.Mock;
const mockUpsert = prisma.boardSettings.upsert as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

const DEFAULT_RESPONSE = {
  showCreatedAt: true,
  showUpdatedAt: false,
  sortOrder: ["dueDate_asc", "providerUpdatedAt_desc"],
};

const STORED_RECORD = {
  id: "bs-1",
  userId: "user-1",
  showCreatedAt: false,
  showUpdatedAt: true,
  sortOrder: ["providerUpdatedAt_desc"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/board-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/board-settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");
  });

  it("returns default values when no DB record exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(DEFAULT_RESPONSE);
    expect(json.error).toBeNull();
  });

  it("returns stored values when record exists", async () => {
    mockFindUnique.mockResolvedValue(STORED_RECORD);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.showCreatedAt).toBe(false);
    expect(json.data.showUpdatedAt).toBe(true);
    expect(json.data.sortOrder).toEqual(["providerUpdatedAt_desc"]);
    expect(json.error).toBeNull();
  });
});

describe("PUT /api/board-settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(makePutRequest({ showCreatedAt: true, showUpdatedAt: false, sortOrder: ["dueDate_asc"] }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");
  });

  it("upserts and returns saved values for valid body", async () => {
    const body = { showCreatedAt: true, showUpdatedAt: true, sortOrder: ["providerUpdatedAt_desc", "dueDate_asc"] };
    mockUpsert.mockResolvedValue({ ...STORED_RECORD, ...body });

    const res = await PUT(makePutRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.showCreatedAt).toBe(true);
    expect(json.data.showUpdatedAt).toBe(true);
    expect(json.data.sortOrder).toEqual(["providerUpdatedAt_desc", "dueDate_asc"]);
    expect(json.error).toBeNull();
  });

  it("returns 400 when showCreatedAt is missing", async () => {
    const res = await PUT(makePutRequest({ showUpdatedAt: false, sortOrder: ["dueDate_asc"] }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 400 when sortOrder contains an invalid element", async () => {
    const res = await PUT(makePutRequest({ showCreatedAt: true, showUpdatedAt: false, sortOrder: ["invalid_criterion"] }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 400 when sortOrder is an empty array", async () => {
    const res = await PUT(makePutRequest({ showCreatedAt: true, showUpdatedAt: false, sortOrder: [] }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 400 when sortOrder contains duplicate criteria", async () => {
    const res = await PUT(makePutRequest({ showCreatedAt: true, showUpdatedAt: false, sortOrder: ["dueDate_asc", "dueDate_asc"] }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });
});
