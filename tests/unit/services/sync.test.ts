/** @jest-environment node */
import { syncProviders } from "@/services/sync";

jest.mock("@/lib/db", () => ({
  prisma: {
    issueProvider: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    issue: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    project: {
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

jest.mock("@/lib/encryption", () => ({
  decrypt: jest.fn().mockReturnValue(JSON.stringify({ token: "test-token" })),
}));

jest.mock("@/services/issue-provider/factory", () => ({
  createAdapter: jest.fn().mockReturnValue({
    fetchAssignedIssues: jest.fn().mockResolvedValue([
      {
        externalId: "42",
        title: "Fix the bug",
        status: "OPEN",
        priority: "HIGH",
        dueDate: null,
        externalUrl: "https://github.com/test/repo/issues/42",
      },
    ]),
  }),
}));

import { prisma } from "@/lib/db";

const mockFindMany = prisma.issueProvider.findMany as jest.Mock;
const mockProjectUpdate = prisma.project.update as jest.Mock;

describe("syncProviders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls adapter for each enabled project and upserts issues", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [
          {
            id: "project-1",
            externalId: "owner/repo",
            isEnabled: true,
          },
        ],
      },
    ]);

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});

    const mockProjectUpdate = prisma.project.update as jest.Mock;
    mockProjectUpdate.mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId_externalId: { projectId: "project-1", externalId: "42" },
        }),
      })
    );
  });

  it("skips disabled projects", async () => {
    // Prisma filters out disabled projects before returning (where: { isEnabled: true })
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [], // no enabled projects after Prisma filter
      },
    ]);

    await syncProviders("user-1");

    expect(prisma.issue.upsert).not.toHaveBeenCalled();
  });

  it("uses external service as source of truth (upserts all returned issues)", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", isEnabled: true }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "1", title: "Issue 1", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://example.com/1" },
        { externalId: "2", title: "Issue 2", status: "OPEN", priority: "HIGH", dueDate: null, externalUrl: "https://example.com/2" },
      ]),
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("handles sync error by recording SYNC_FAILED on project", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", isEnabled: true }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(new Error("Network error")),
    });

    mockProjectUpdate.mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockProjectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncError: "SYNC_FAILED",
          lastSyncedAt: expect.any(Date),
        }),
      })
    );
  });

  it("deletes issues that are no longer returned by the adapter", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "REDMINE",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "my-project", isEnabled: true }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    // Only issue "10" is returned — issue "99" was closed externally
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "10", title: "Still open", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://redmine.example.com/issues/10" },
      ]),
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    const mockDeleteMany = prisma.issue.deleteMany as jest.Mock;
    mockDeleteMany.mockResolvedValue({ count: 1 });
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        externalId: { notIn: ["10"] },
      },
    });
  });

  it("handles rate limit error by recording RATE_LIMITED", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", isEnabled: true }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(new Error("API rate limit exceeded")),
    });

    mockProjectUpdate.mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockProjectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncError: "RATE_LIMITED",
          lastSyncedAt: expect.any(Date),
        }),
      })
    );
  });
});
