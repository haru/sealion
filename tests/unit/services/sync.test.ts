/** @jest-environment node */
import { syncProviders } from "@/services/sync";
import { SyncErrorCause, SyncErrorInfo } from "@/lib/types";

jest.mock("@/lib/db/db", () => ({
  prisma: {
    issueProvider: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    issue: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

jest.mock("@/lib/encryption/encryption", () => ({
  decrypt: jest.fn().mockReturnValue(JSON.stringify({ token: "test-token" })),
}));

jest.mock("@/lib/encryption/credentials", () => ({
  decryptProviderCredentials: jest.fn().mockReturnValue({ token: "test-token" }),
}));

jest.mock("@/services/issue-provider/factory", () => ({
  createAdapter: jest.fn().mockReturnValue({
    fetchAssignedIssues: jest.fn().mockResolvedValue([
      {
        externalId: "42",
        title: "Fix the bug",
        dueDate: null,
        externalUrl: "https://github.com/test/repo/issues/42",
        isUnassigned: false,
      },
    ]),
    fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
  }),
}));

import { prisma } from "@/lib/db/db";

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

  it("skips providers with no projects", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [],
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
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "1", title: "Issue 1", dueDate: null, externalUrl: "https://example.com/1", isUnassigned: false },
        { externalId: "2", title: "Issue 2", dueDate: null, externalUrl: "https://example.com/2", isUnassigned: false },
      ]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("handles sync error by recording error info on project", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(new Error("Network error")),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    mockProjectUpdate.mockResolvedValue({});

    await syncProviders("user-1");

    const call = (prisma.project.update as jest.Mock).mock.calls[0][0];
    const syncError: SyncErrorInfo = JSON.parse(call.data.syncError);
    expect(syncError.cause).toBe(SyncErrorCause.UNKNOWN);
    expect(syncError.projectName).toBe("owner/repo");
    expect(call.data.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("deletes issues that are no longer returned by the adapter", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "REDMINE",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "my-project", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    // Only issue "10" is returned — issue "99" was closed externally
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "10", title: "Still open", dueDate: null, externalUrl: "https://redmine.example.com/issues/10", isUnassigned: false },
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

  it("handles rate limit error by recording RATE_LIMIT cause", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    const rateLimitError = Object.assign(new Error("Request failed with status 429"), {
      isAxiosError: true,
      response: { status: 429 },
    });
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(rateLimitError),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    mockProjectUpdate.mockResolvedValue({});

    await syncProviders("user-1");

    const call = (prisma.project.update as jest.Mock).mock.calls[0][0];
    const syncError: SyncErrorInfo = JSON.parse(call.data.syncError);
    expect(syncError.cause).toBe(SyncErrorCause.RATE_LIMIT);
    expect(syncError.statusCode).toBe(429);
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
      { externalId: "1", title: "Assigned", dueDate: null, externalUrl: "https://ex.com/1", isUnassigned: false },
    ]);
    const mockFetchUnassigned = jest.fn().mockResolvedValue([
      { externalId: "2", title: "Unassigned", dueDate: null, externalUrl: "https://ex.com/2", isUnassigned: true },
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

    const assignedIssue = { externalId: "42", title: "Bug", dueDate: null, externalUrl: "https://ex.com/42", isUnassigned: false };
    const unassignedIssue = { externalId: "42", title: "Bug", dueDate: null, externalUrl: "https://ex.com/42", isUnassigned: true };

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

  it("persists providerCreatedAt and providerUpdatedAt in upsert update block", async () => {
    const providerCreatedAt = new Date("2026-01-15T10:00:00Z");
    const providerUpdatedAt = new Date("2026-03-10T14:30:00Z");

    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        {
          externalId: "42",
          title: "Fix the bug",
          dueDate: null,
          externalUrl: "https://github.com/test/repo/issues/42",
          isUnassigned: false,
          providerCreatedAt,
          providerUpdatedAt,
        },
      ]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          providerCreatedAt,
          providerUpdatedAt,
        }),
      })
    );
  });

  it("persists providerCreatedAt and providerUpdatedAt in upsert create block", async () => {
    const providerCreatedAt = new Date("2026-01-15T10:00:00Z");
    const providerUpdatedAt = new Date("2026-03-10T14:30:00Z");

    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        {
          externalId: "42",
          title: "Fix the bug",
          dueDate: null,
          externalUrl: "https://github.com/test/repo/issues/42",
          isUnassigned: false,
          providerCreatedAt,
          providerUpdatedAt,
        },
      ]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          providerCreatedAt,
          providerUpdatedAt,
        }),
      })
    );
  });

  it("marks project as SYNC_FAILED when fetchUnassignedIssues fails", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: true }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "1", title: "Assigned", dueDate: null, externalUrl: "https://ex.com/1", isUnassigned: false },
      ]),
      fetchUnassignedIssues: jest.fn().mockRejectedValue(new Error("Unassigned fetch failed")),
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    // Unassigned fetch failure is fatal — no upserts should occur (avoids deleting valid issues)
    expect(mockUpsert).not.toHaveBeenCalled();
    // Project should be marked as failed with structured error info
    const updateCall = (prisma.project.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "project-1" });
    const syncError: SyncErrorInfo = JSON.parse(updateCall.data.syncError);
    expect(syncError.cause).toBe(SyncErrorCause.UNKNOWN);
  });

  it("returns empty array when all projects sync successfully", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    (prisma.issue.upsert as jest.Mock).mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    const errors = await syncProviders("user-1");

    expect(errors).toHaveLength(0);
  });

  it("returns SyncErrorInfo with provider name and project name when a project fails", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        displayName: "My GitHub",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", displayName: "My Repo", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(
        Object.assign(new Error("Unauthorized"), { isAxiosError: true, response: { status: 401, data: { message: "Bad credentials" }, statusText: "Unauthorized" } })
      ),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    const errors = await syncProviders("user-1");

    expect(errors).toHaveLength(1);
    expect(errors[0].providerName).toBe("My GitHub");
    expect(errors[0].projectName).toBe("My Repo");
    expect(errors[0].cause).toBe(SyncErrorCause.AUTHENTICATION);
    expect(errors[0].statusCode).toBe(401);
    expect(errors[0].providerMessage).toBe("Bad credentials");
  });

  it("does not persist technicalMessage in project.syncError JSON", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(new Error("secret internal detail")),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });
    mockProjectUpdate.mockResolvedValue({});

    await syncProviders("user-1");

    const call = (prisma.project.update as jest.Mock).mock.calls[0][0];
    const stored: Record<string, unknown> = JSON.parse(call.data.syncError);
    expect(stored).not.toHaveProperty("technicalMessage");
  });

  it("collects errors from multiple failed projects", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [
          { id: "project-1", externalId: "owner/repo1", includeUnassigned: false },
          { id: "project-2", externalId: "owner/repo2", includeUnassigned: false },
        ],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    const authError = Object.assign(new Error("Unauthorized"), { isAxiosError: true, response: { status: 401, data: null, statusText: "Unauthorized" } });
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(authError),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    const errors = await syncProviders("user-1");

    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e.cause === SyncErrorCause.AUTHENTICATION)).toBe(true);
  });

  it("continues syncing other providers when one provider's credential decryption fails", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        displayName: "Broken Provider",
        encryptedCredentials: "corrupted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo1", displayName: "Repo 1", includeUnassigned: false }],
      },
      {
        id: "provider-2",
        type: "GITHUB",
        displayName: "Working Provider",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-2", externalId: "owner/repo2", displayName: "Repo 2", includeUnassigned: false }],
      },
    ]);

    const { decryptProviderCredentials } = jest.requireMock("@/lib/encryption/credentials");
    decryptProviderCredentials.mockImplementation((encrypted: string) => {
      if (encrypted === "corrupted") {
        throw new Error("Decryption failed");
      }
      return { token: "test-token" };
    });

    const mockUpsert = prisma.issue.upsert as jest.Mock;
    mockUpsert.mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    const errors = await syncProviders("user-1");

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].providerName).toBe("Broken Provider");
    expect(errors[0].projectName).toBe("Repo 1");
    expect(errors[0].cause).toBe(SyncErrorCause.UNKNOWN);
  });

  it("calls enrichCreationDates and batches updates for issues with missing providerCreatedAt", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "TRELLO",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "board-1", includeUnassigned: false }],
      },
    ]);

    const mockEnrichCreationDates = jest.fn().mockResolvedValue(
      new Map([["card-1", new Date("2026-01-01T00:00:00Z")]])
    );

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "card-1", title: "Card 1", dueDate: null, externalUrl: "https://trello.com/c/card-1", isUnassigned: false },
      ]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
      enrichCreationDates: mockEnrichCreationDates,
    });

    (prisma.issue.upsert as jest.Mock).mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});
    (prisma.issue.findMany as jest.Mock).mockResolvedValue([{ externalId: "card-1" }]);
    (prisma.issue.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await syncProviders("user-1");

    expect(mockEnrichCreationDates).toHaveBeenCalledWith(["card-1"]);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything()])
    );
    expect(prisma.issue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "project-1", externalId: "card-1" },
        data: { providerCreatedAt: new Date("2026-01-01T00:00:00Z") },
      })
    );
  });

  it("swallows enrichCreationDates errors so sync success is not downgraded", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "TRELLO",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "board-1", includeUnassigned: false }],
      },
    ]);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([
        { externalId: "card-1", title: "Card 1", dueDate: null, externalUrl: "https://trello.com/c/card-1", isUnassigned: false },
      ]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
      enrichCreationDates: jest.fn().mockRejectedValue(new Error("Rate limit exceeded")),
    });

    (prisma.issue.upsert as jest.Mock).mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});
    (prisma.issue.findMany as jest.Mock).mockResolvedValue([{ externalId: "card-1" }]);

    const errors = await syncProviders("user-1");

    // Enrichment failure must not fail the sync
    expect(errors).toHaveLength(0);
    // Project must not be marked with syncError due to enrichment failure
    const updateCall = (prisma.project.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.syncError).toBeNull();
  });

  it("skips enrichCreationDates when adapter does not implement the method", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        encryptedCredentials: "encrypted",
        userId: "user-1",
        projects: [{ id: "project-1", externalId: "owner/repo", includeUnassigned: false }],
      },
    ]);

    (prisma.issue.upsert as jest.Mock).mockResolvedValue({});
    (prisma.project.update as jest.Mock).mockResolvedValue({});

    await syncProviders("user-1");

    expect(prisma.issue.findMany).not.toHaveBeenCalled();
  });

  it("persists syncError on project records when credential decryption fails", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "provider-1",
        type: "GITHUB",
        displayName: "Broken Provider",
        encryptedCredentials: "corrupted",
        userId: "user-1",
        projects: [
          { id: "project-1", externalId: "owner/repo1", displayName: "Repo 1", includeUnassigned: false },
          { id: "project-2", externalId: "owner/repo2", displayName: "Repo 2", includeUnassigned: false },
        ],
      },
    ]);

    const { decryptProviderCredentials } = jest.requireMock("@/lib/encryption/credentials");
    decryptProviderCredentials.mockImplementation((encrypted: string) => {
      if (encrypted === "corrupted") {
        throw new Error("Decryption failed");
      }
      return { token: "test-token" };
    });

    (prisma.project.update as jest.Mock).mockResolvedValue({});

    const errors = await syncProviders("user-1");

    expect(errors).toHaveLength(2);
    expect(prisma.project.update).toHaveBeenCalledTimes(2);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { syncError: expect.any(String), lastSyncedAt: expect.any(Date) },
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-2" },
      data: { syncError: expect.any(String), lastSyncedAt: expect.any(Date) },
    });
  });
});
