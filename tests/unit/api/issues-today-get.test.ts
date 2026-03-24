/** @jest-environment node */
import { GET } from "@/app/api/issues/today/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: { issue: { findMany: jest.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.issue.findMany as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/issues/today");
}

const TODAY_ISSUE = {
  id: "i1",
  externalId: "42",
  title: "Today task",
  dueDate: null,
  externalUrl: "https://github.com/x/y/issues/42",
  isUnassigned: false,
  todayFlag: true,
  todayOrder: 1,
  todayAddedAt: new Date("2026-03-21T09:00:00Z"),
  providerCreatedAt: null,
  providerUpdatedAt: null,
  project: { displayName: "repo", issueProvider: { type: "GITHUB", displayName: "My GH" } },
};

describe("GET /api/issues/today", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with today items sorted by todayOrder asc", async () => {
    mockFindMany.mockResolvedValue([TODAY_ISSUE]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0].id).toBe("i1");
  });

  it("queries only todayFlag=true issues for the current user", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          todayFlag: true,
          project: { issueProvider: { userId: "user-1" } },
        }),
      })
    );
  });

  it("orders by todayOrder ascending", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual(
      expect.arrayContaining([{ todayOrder: "asc" }])
    );
  });

  it("includes iconUrl derived from provider type", async () => {
    mockFindMany.mockResolvedValue([TODAY_ISSUE]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.data.items[0].project.issueProvider).toHaveProperty("iconUrl");
  });

  it("selects required fields including todayFlag, todayOrder, todayAddedAt", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.select.todayFlag).toBe(true);
    expect(call.select.todayOrder).toBe(true);
    expect(call.select.todayAddedAt).toBe(true);
  });

  it("does not include priority in select", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest());

    const call = mockFindMany.mock.calls[0][0];
    expect(call.select).not.toHaveProperty("priority");
  });
});
