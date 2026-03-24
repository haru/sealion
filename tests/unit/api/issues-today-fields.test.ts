/** @jest-environment node */
import { GET } from "@/app/api/issues/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: { issue: { findMany: jest.fn(), count: jest.fn() } },
}));
jest.mock("@/services/issue-provider/factory", () => ({
  getProviderIconUrl: jest.fn().mockReturnValue("https://example.com/icon.png"),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.issue.findMany as jest.Mock;
const mockCount = prisma.issue.count as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

const TODAY_ISSUE = {
  id: "i1",
  externalId: "1",
  title: "Today task",
  dueDate: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  externalUrl: "https://github.com/x/y/issues/1",
  isUnassigned: false,
  todayFlag: true,
  todayOrder: 1,
  todayAddedAt: new Date("2026-03-21T09:00:00.000Z"),
  project: { displayName: "repo", issueProvider: { type: "GITHUB", displayName: "My GH" } },
};

const REGULAR_ISSUE = {
  id: "i2",
  externalId: "2",
  title: "Regular task",
  dueDate: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  externalUrl: "https://github.com/x/y/issues/2",
  isUnassigned: false,
  todayFlag: false,
  todayOrder: null,
  todayAddedAt: null,
  project: { displayName: "repo", issueProvider: { type: "GITHUB", displayName: "My GH" } },
};

function makeRequest(search = ""): NextRequest {
  return new NextRequest(`http://localhost/api/issues${search}`);
}

describe("GET /api/issues — today fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(2);
  });

  it("includes todayFlag in each issue item", async () => {
    mockFindMany.mockResolvedValue([TODAY_ISSUE, REGULAR_ISSUE]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.items[0].todayFlag).toBe(true);
    expect(json.data.items[1].todayFlag).toBe(false);
  });

  it("includes todayOrder in each issue item", async () => {
    mockFindMany.mockResolvedValue([TODAY_ISSUE, REGULAR_ISSUE]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.data.items[0].todayOrder).toBe(1);
    expect(json.data.items[1].todayOrder).toBeNull();
  });

  it("includes todayAddedAt in each issue item", async () => {
    mockFindMany.mockResolvedValue([TODAY_ISSUE, REGULAR_ISSUE]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.data.items[0].todayAddedAt).toBeDefined();
    expect(json.data.items[1].todayAddedAt).toBeNull();
  });

  it("returns totalToday in the response", async () => {
    mockFindMany.mockResolvedValue([TODAY_ISSUE, REGULAR_ISSUE]);
    mockCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.totalToday).toBe(1);
  });

  it("requests todayFlag/todayOrder/todayAddedAt in the DB select", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await GET(makeRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          todayFlag: true,
          todayOrder: true,
          todayAddedAt: true,
        }),
      })
    );
  });
});
