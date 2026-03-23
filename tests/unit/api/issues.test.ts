/** @jest-environment node */
import { GET } from "@/app/api/issues/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: { issue: { findMany: jest.fn(), count: jest.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.issue.findMany as jest.Mock;
const mockCount = prisma.issue.count as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

function makeRequest(search = ""): NextRequest {
  return new NextRequest(`http://localhost/api/issues${search}`);
}

const OPEN_ISSUE = {
  id: "i1",
  externalId: "42",
  title: "Bug",
  status: "OPEN",
  priority: "HIGH",
  dueDate: new Date("2026-04-01"),
  externalUrl: "https://github.com/x/y/issues/42",
  isUnassigned: false,
  project: { displayName: "repo", issueProvider: { type: "GITHUB", displayName: "My GH" } },
};

const CLOSED_ISSUE = { ...OPEN_ISSUE, id: "i2", status: "CLOSED", priority: "LOW", dueDate: null };

describe("GET /api/issues", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(2);
  });

  it("returns 200 with paginated issues", async () => {
    mockFindMany.mockResolvedValue([OPEN_ISSUE]);

    const res = await GET(makeRequest("?page=1&limit=10"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.items).toBeDefined();
    expect(json.data.total).toBe(2);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("sorts OPEN before CLOSED", async () => {
    mockFindMany.mockResolvedValue([OPEN_ISSUE, CLOSED_ISSUE]);

    const res = await GET(makeRequest());
    const json = await res.json();
    const statuses = json.data.items.map((i: { status: string }) => i.status);

    expect(statuses[0]).toBe("OPEN");
  });

  it("filters by status when provided", async () => {
    mockFindMany.mockResolvedValue([OPEN_ISSUE]);
    mockCount.mockResolvedValue(1);

    const res = await GET(makeRequest("?status=OPEN"));
    const json = await res.json();

    expect(res.status).toBe(200);
    // Verify findMany was called with status filter
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPEN" }),
      })
    );
  });

  it("includes isUnassigned field in each issue item", async () => {
    const unassignedIssue = { ...OPEN_ISSUE, id: "i3", isUnassigned: true };
    mockFindMany.mockResolvedValue([OPEN_ISSUE, unassignedIssue]);
    mockCount.mockResolvedValue(2);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.items[0].isUnassigned).toBe(false);
    expect(json.data.items[1].isUnassigned).toBe(true);
  });

  it("orders by dueDate asc nulls last as second orderBy key", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual(
      expect.arrayContaining([
        { dueDate: { sort: "asc", nulls: "last" } },
      ])
    );
  });

  it("orders by providerUpdatedAt desc nulls last as third orderBy key", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual(
      expect.arrayContaining([
        { providerUpdatedAt: { sort: "desc", nulls: "last" } },
      ])
    );
  });

  it("orders by providerCreatedAt desc nulls last as fourth orderBy key", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual(
      expect.arrayContaining([
        { providerCreatedAt: { sort: "desc", nulls: "last" } },
      ])
    );
  });

  it("excludes today-flagged OPEN issues from paginated list and total count", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const findManyCall = mockFindMany.mock.calls[0][0];
    expect(findManyCall.where).toMatchObject({
      OR: [{ todayFlag: { not: true } }, { status: { not: "OPEN" } }],
    });

    const regularCountCall = mockCount.mock.calls.find(
      ([arg]: [{ where: Record<string, unknown> }]) => arg?.where?.OR !== undefined
    );
    expect(regularCountCall).toBeDefined();
    expect(regularCountCall[0].where).toMatchObject({
      OR: [{ todayFlag: { not: true } }, { status: { not: "OPEN" } }],
    });
  });

  it("counts totalToday independently of status filter", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest("?status=CLOSED"));

    const todayCountCall = mockCount.mock.calls.find(
      ([arg]: [{ where: Record<string, unknown> }]) =>
        arg?.where?.todayFlag === true && arg?.where?.status === "OPEN"
    );
    expect(todayCountCall).toBeDefined();
    // totalToday where must not include the CLOSED status filter
    expect(todayCountCall[0].where).not.toHaveProperty("NOT");
  });

  it("does not use priority as an orderBy key", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    const orderByKeys = call.orderBy.flatMap((o: Record<string, unknown>) => Object.keys(o));
    expect(orderByKeys).not.toContain("priority");
  });

  it("includes providerCreatedAt and providerUpdatedAt in select", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.select.providerCreatedAt).toBe(true);
    expect(call.select.providerUpdatedAt).toBe(true);
  });
});
