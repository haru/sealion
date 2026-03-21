/** @jest-environment node */
import { PATCH } from "@/app/api/issues/today/reorder/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    issue: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.issue.findMany as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

const TODAY_ISSUES = [
  { id: "i1", todayFlag: true, todayOrder: 1, project: { issueProvider: { userId: "user-1" } } },
  { id: "i2", todayFlag: true, todayOrder: 2, project: { issueProvider: { userId: "user-1" } } },
  { id: "i3", todayFlag: true, todayOrder: 3, project: { issueProvider: { userId: "user-1" } } },
];

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/issues/today/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/issues/today/reorder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
    mockTransaction.mockResolvedValue([]);
  });

  it("returns 200 and updates todayOrder for all given ids", async () => {
    mockFindMany.mockResolvedValue(TODAY_ISSUES);

    const req = makeRequest({ orderedIds: ["i3", "i1", "i2"] });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(3);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it("returns 400 when orderedIds is empty", async () => {
    const req = makeRequest({ orderedIds: [] });
    const res = await PATCH(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when orderedIds is missing", async () => {
    const req = makeRequest({});
    const res = await PATCH(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when orderedIds contains duplicate ids", async () => {
    const req = makeRequest({ orderedIds: ["i1", "i2", "i1"] });
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 when any id does not belong to user or lacks todayFlag", async () => {
    // Returns only 2 of the 3 ids — one is not owned/today
    mockFindMany.mockResolvedValue(TODAY_ISSUES.slice(0, 2));

    const req = makeRequest({ orderedIds: ["i1", "i2", "i-other"] });
    const res = await PATCH(req);

    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest({ orderedIds: ["i1", "i2"] });
    const res = await PATCH(req);

    expect(res.status).toBe(401);
  });
});
