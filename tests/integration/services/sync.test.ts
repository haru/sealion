/** @jest-environment node */
/**
 * Integration tests for syncProviders error collection.
 * These tests verify the integration between sync.ts and error-utils.ts:
 * how errors are classified, stored, and returned.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { syncProviders } from '@/services/sync';
import { SyncErrorCause, SyncErrorInfo } from '@/lib/types';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    issueProvider: { findMany: jest.fn() },
    issue: { upsert: jest.fn(), deleteMany: jest.fn() },
    project: { update: jest.fn() },
    $transaction: jest.fn().mockImplementation((fnOrOps: unknown) => {
      if (typeof fnOrOps === 'function') {
        return (fnOrOps as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(fnOrOps as Promise<unknown>[]);
    }),
  },
}));

jest.mock('@/lib/encryption', () => ({
  decrypt: jest.fn().mockReturnValue(JSON.stringify({ token: 'test-token' })),
}));

jest.mock('@/services/issue-provider/factory', () => ({
  createAdapter: jest.fn(),
}));

const mockFindMany = prisma.issueProvider.findMany as jest.Mock;
const mockProjectUpdate = prisma.project.update as jest.Mock;

function makeProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: 'provider-1',
    type: 'GITHUB',
    displayName: 'My GitHub',
    encryptedCredentials: 'encrypted',
    baseUrl: null,
    userId: 'user-1',
    projects: [
      { id: 'project-1', externalId: 'owner/repo', displayName: 'My Repo', includeUnassigned: false },
    ],
    ...overrides,
  };
}

function makeAxiosError(status: number, data: unknown = null) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data, statusText: String(status) },
  });
}

describe('syncProviders error collection integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectUpdate.mockResolvedValue({});
    (prisma.issue.upsert as jest.Mock).mockResolvedValue({});
    (prisma.issue.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('returns empty array when all projects sync successfully', async () => {
    mockFindMany.mockResolvedValue([makeProvider()]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockResolvedValue([]),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors).toHaveLength(0);
  });

  it('returns SyncErrorInfo with correct provider and project names on failure', async () => {
    mockFindMany.mockResolvedValue([makeProvider()]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(makeAxiosError(401, { message: 'Bad credentials' })),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors).toHaveLength(1);
    expect(errors[0].providerName).toBe('My GitHub');
    expect(errors[0].projectName).toBe('My Repo');
  });

  it('classifies HTTP 401 as AUTHENTICATION cause', async () => {
    mockFindMany.mockResolvedValue([makeProvider()]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(makeAxiosError(401)),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors[0].cause).toBe(SyncErrorCause.AUTHENTICATION);
    expect(errors[0].statusCode).toBe(401);
  });

  it('classifies HTTP 429 as RATE_LIMIT cause', async () => {
    mockFindMany.mockResolvedValue([makeProvider()]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(makeAxiosError(429)),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors[0].cause).toBe(SyncErrorCause.RATE_LIMIT);
    expect(errors[0].statusCode).toBe(429);
  });

  it('stores JSON-encoded SyncErrorInfo in project.syncError', async () => {
    mockFindMany.mockResolvedValue([makeProvider()]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(makeAxiosError(403)),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    await syncProviders('user-1');

    const call = mockProjectUpdate.mock.calls[0][0];
    const stored: SyncErrorInfo = JSON.parse(call.data.syncError);
    expect(stored.cause).toBe(SyncErrorCause.AUTHENTICATION);
    expect(stored.providerName).toBe('My GitHub');
    expect(stored.projectName).toBe('My Repo');
  });

  it('collects one error per failed project across multiple projects', async () => {
    mockFindMany.mockResolvedValue([
      makeProvider({
        projects: [
          { id: 'project-1', externalId: 'owner/repo1', displayName: 'Repo 1', includeUnassigned: false },
          { id: 'project-2', externalId: 'owner/repo2', displayName: 'Repo 2', includeUnassigned: false },
        ],
      }),
    ]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(makeAxiosError(404)),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors).toHaveLength(2);
    expect(errors[0].cause).toBe(SyncErrorCause.NOT_FOUND);
    expect(errors[1].cause).toBe(SyncErrorCause.NOT_FOUND);
    const projectNames = errors.map((e) => e.projectName);
    expect(projectNames).toContain('Repo 1');
    expect(projectNames).toContain('Repo 2');
  });

  it('includes provider message from API response in returned error', async () => {
    mockFindMany.mockResolvedValue([makeProvider()]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(
        makeAxiosError(401, { message: 'Bad credentials' })
      ),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors[0].providerMessage).toBe('Bad credentials');
  });

  it('falls back to provider.type when provider.displayName is absent', async () => {
    mockFindMany.mockResolvedValue([makeProvider({ displayName: undefined })]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(makeAxiosError(500)),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors[0].providerName).toBe('GITHUB');
  });

  it('falls back to project.externalId when project.displayName is absent', async () => {
    mockFindMany.mockResolvedValue([
      makeProvider({
        projects: [{ id: 'project-1', externalId: 'owner/repo', displayName: undefined, includeUnassigned: false }],
      }),
    ]);
    const { createAdapter } = jest.requireMock('@/services/issue-provider/factory');
    createAdapter.mockReturnValueOnce({
      fetchAssignedIssues: jest.fn().mockRejectedValue(makeAxiosError(500)),
      fetchUnassignedIssues: jest.fn().mockResolvedValue([]),
    });

    const errors = await syncProviders('user-1');

    expect(errors[0].projectName).toBe('owner/repo');
  });
});
