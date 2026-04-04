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
  dueDate: new Date("2026-04-01"),
  externalUrl: "https://github.com/x/y/issues/42",
  isUnassigned: false,
  project: { displayName: "repo", issueProvider: { type: "GITHUB", displayName: "My GH" } },
};

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

  it("sortOrder=providerCreatedAt_desc sorts by providerCreatedAt desc nulls last", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest("?sortOrder=providerCreatedAt_desc"));

    const call = mockFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual(
      expect.arrayContaining([
        { providerCreatedAt: { sort: "desc", nulls: "last" } },
      ])
    );
  });

  it("excludes today-flagged issues from paginated list and total count", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const findManyCall = mockFindMany.mock.calls[0][0];
    expect(findManyCall.where).toMatchObject({
      todayFlag: { not: true },
    });

    const regularCountCall = mockCount.mock.calls.find(
      ([arg]: [{ where: Record<string, unknown> }]) => arg?.where?.todayFlag !== undefined
    );
    expect(regularCountCall).toBeDefined();
    expect(regularCountCall[0].where).toMatchObject({
      todayFlag: { not: true },
    });
  });

  it("does not use priority as an orderBy key", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    const orderByKeys = call.orderBy.flatMap((o: Record<string, unknown>) => Object.keys(o));
    expect(orderByKeys).not.toContain("priority");
  });

  it("does not include priority in select", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    const selectKeys = Object.keys(call.select ?? {});
    expect(selectKeys).not.toContain("priority");
  });

  it("includes providerCreatedAt and providerUpdatedAt in select", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.select.providerCreatedAt).toBe(true);
    expect(call.select.providerUpdatedAt).toBe(true);
  });

  it("uses pinned: desc as the first orderBy entry regardless of sort params", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.orderBy[0]).toEqual({ pinned: "desc" });
  });

  it("uses pinned: desc as first entry even when explicit sortOrder param is provided", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest("?sortOrder=providerUpdatedAt_desc"));

    const call = mockFindMany.mock.calls[0][0];
    expect(call.orderBy[0]).toEqual({ pinned: "desc" });
  });

  it("includes pinned in select clause", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.select.pinned).toBe(true);
  });

  it("returns pinned field in each issue item", async () => {
    const issueWithPin = {
      ...OPEN_ISSUE,
      pinned: true,
      todayFlag: false,
      todayOrder: null,
      todayAddedAt: null,
      providerCreatedAt: null,
      providerUpdatedAt: null,
    };
    mockFindMany.mockResolvedValue([issueWithPin]);
    mockCount.mockResolvedValue(1);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.items[0].pinned).toBe(true);
  });

  describe("sortOrder query parameter", () => {
    it("no sortOrder param uses default order: pinned first, then dueDate, then providerUpdatedAt", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest());

      const call = mockFindMany.mock.calls[0][0];
      const orderByKeys = call.orderBy.map((o: Record<string, unknown>) => Object.keys(o)[0]);
      expect(orderByKeys[0]).toBe("pinned");
      expect(orderByKeys[1]).toBe("dueDate");
      expect(orderByKeys[2]).toBe("providerUpdatedAt");
    });

    it("sortOrder=providerUpdatedAt_desc uses pinned first, then providerUpdatedAt", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?sortOrder=providerUpdatedAt_desc"));

      const call = mockFindMany.mock.calls[0][0];
      const orderByKeys = call.orderBy.map((o: Record<string, unknown>) => Object.keys(o)[0]);
      expect(orderByKeys[0]).toBe("pinned");
      expect(orderByKeys[1]).toBe("providerUpdatedAt");
    });

    it("sortOrder=dueDate_asc,providerUpdatedAt_desc uses pinned first, then dueDate with NULLS LAST", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?sortOrder=dueDate_asc%2CproviderUpdatedAt_desc"));

      const call = mockFindMany.mock.calls[0][0];
      const orderByKeys = call.orderBy.map((o: Record<string, unknown>) => Object.keys(o)[0]);
      expect(orderByKeys[0]).toBe("pinned");
      expect(orderByKeys[1]).toBe("dueDate");
      expect(orderByKeys[2]).toBe("providerUpdatedAt");
      expect(call.orderBy[1].dueDate).toMatchObject({ sort: "asc", nulls: "last" });
    });

    it("invalid sortOrder value falls back to default (pinned first, then dueDate)", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?sortOrder=invalid_criterion"));

      const call = mockFindMany.mock.calls[0][0];
      const orderByKeys = call.orderBy.map((o: Record<string, unknown>) => Object.keys(o)[0]);
      expect(orderByKeys[0]).toBe("pinned");
      expect(orderByKeys[1]).toBe("dueDate");
    });

    it("deduplicates repeated sortOrder values", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?sortOrder=dueDate_asc%2CdueDate_asc%2CproviderUpdatedAt_desc"));

      const call = mockFindMany.mock.calls[0][0];
      const orderByKeys = call.orderBy.map((o: Record<string, unknown>) => Object.keys(o)[0]);
      // Pinned always first + deduplicated user criteria + tiebreaker (id)
      expect(orderByKeys).toEqual(["pinned", "dueDate", "providerUpdatedAt", "id"]);
    });

    it("caps excessive sortOrder values at MAX_SORT_CRITERIA entries (excluding pinned prefix and tiebreaker)", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const manyValues = Array(10).fill("dueDate_asc,providerUpdatedAt_desc,providerCreatedAt_desc").join(",");
      await GET(makeRequest(`?sortOrder=${encodeURIComponent(manyValues)}`));

      const call = mockFindMany.mock.calls[0][0];
      // pinned prefix + at most MAX_SORT_CRITERIA user criteria + 1 tiebreaker
      expect(call.orderBy.length).toBeLessThanOrEqual(5);
      // The last entry must be the tiebreaker
      const lastKey = Object.keys(call.orderBy[call.orderBy.length - 1])[0];
      expect(lastKey).toBe("id");
    });

    it("always appends id tiebreaker as the last orderBy entry for stable pagination", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?sortOrder=providerCreatedAt_desc"));

      const call = mockFindMany.mock.calls[0][0];
      const lastKey = Object.keys(call.orderBy[call.orderBy.length - 1])[0];
      expect(lastKey).toBe("id");
    });
  });

  describe("q parameter with embedded filters", () => {
    it("applies provider filter parsed from q when explicit provider param is absent", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?q=provider%3AGITHUB%20bug"));

      const call = mockFindMany.mock.calls[0][0];
      const where = call.where;
      // Provider filter should be applied from the parsed q parameter
      expect(where.project.issueProvider.type).toBe("GITHUB");
      // Keyword should be applied
      expect(where.OR).toEqual([{ title: { contains: "bug", mode: "insensitive" } }]);
    });

    it("explicit provider param takes precedence over provider in q", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?q=provider%3AREDMINE%20bug&provider=JIRA"));

      const call = mockFindMany.mock.calls[0][0];
      // Explicit param should win
      expect(call.where.project.issueProvider.type).toBe("JIRA");
    });

    it("applies assignee filter parsed from q when explicit param is absent", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await GET(makeRequest("?q=assignee%3Aunassigned"));

      const call = mockFindMany.mock.calls[0][0];
      expect(call.where.isUnassigned).toBe(true);
    });
  });

  describe("invalid page and limit params", () => {
    beforeEach(() => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
    });

    it("falls back to page=1 when page is non-numeric", async () => {
      const res = await GET(makeRequest("?page=abc"));
      expect(res.status).toBe(200);
      const call = mockFindMany.mock.calls[0][0];
      expect(call.skip).toBe(0); // (1 - 1) * 20 = 0
    });

    it("falls back to limit=20 when limit is non-numeric", async () => {
      const res = await GET(makeRequest("?limit=xyz"));
      expect(res.status).toBe(200);
      const call = mockFindMany.mock.calls[0][0];
      expect(call.take).toBe(20);
    });

    it("falls back to page=1 when page is a float string", async () => {
      const res = await GET(makeRequest("?page=1.5"));
      expect(res.status).toBe(200);
      const call = mockFindMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
    });
  });
});
