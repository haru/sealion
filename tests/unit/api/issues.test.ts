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
});
