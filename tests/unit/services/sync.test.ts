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
    $transaction: jest.fn().mockImplementation((fnOrOps: unknown) => {
      if (typeof fnOrOps === "function") {
        return (fnOrOps as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(fnOrOps as Promise<unknown>[]);
    }),
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
        isUnassigned: false,
      },
    ]),
    fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
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
            includeUnassigned: false,
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
        projects: [{ id: "project-1", externalId: "owner/repo", isEnabled: true, includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "1", title: "Issue 1", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://example.com/1", isUnassigned: false },
        { externalId: "2", title: "Issue 2", status: "OPEN", priority: "HIGH", dueDate: null, externalUrl: "https://example.com/2", isUnassigned: false },
      ]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
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
        projects: [{ id: "project-1", externalId: "owner/repo", isEnabled: true, includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(new Error("Network error")),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
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
        projects: [{ id: "project-1", externalId: "my-project", isEnabled: true, includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    // Only issue "10" is returned — issue "99" was closed externally
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "10", title: "Still open", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://redmine.example.com/issues/10", isUnassigned: false },
      ]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
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
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
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

  it("calls fetchUnassignedIssues when project.includeUnassigned is true", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: true }],
      },
    ]);

    const mockFetchAssigned = jest.fn().mockResolvedValue([
      { externalId: "1", title: "Assigned", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://ex.com/1", isUnassigned: false },
    ]);
    const mockFetchUnassigned = jest.fn().mockResolvedValue([
      { externalId: "2", title: "Unassigned", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://ex.com/2", isUnassigned: true },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: mockFetchAssigned,
      fetchUnassignedIssues: mockFetchUnassigned,
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockFetchUnassigned).toHaveBeenCalledWith("owner/repo");
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("does not call fetchUnassignedIssues when project.includeUnassigned is false", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    const mockFetchUnassigned = jest.fn().mockResolvedValue([]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([]),
      fetchUnassignedIssues: mockFetchUnassigned,
    });

    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockFetchUnassigned).not.toHaveBeenCalled();
  });

  it("deduplicates: assigned issue takes priority over unassigned for same externalId", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: true }],
      },
    ]);

    const assignedIssue = { externalId: "42", title: "Bug", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://ex.com/42", isUnassigned: false };
    const unassignedIssue = { externalId: "42", title: "Bug", status: "OPEN", priority: "MEDIUM", dueDate: null, externalUrl: "https://ex.com/42", isUnassigned: true };

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([assignedIssue]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([unassignedIssue]),
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    // Only one upsert — the duplicate unassigned is filtered out
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isUnassigned: false }),
      })
    );
  });
});
