/** @jest-environment node */
import { buildTypedCredentials, decryptProviderCredentials } from '@/lib/encryption/credentials';

const mockDecrypt = jest.fn();
const mockGetProviderMetadata = jest.fn();

jest.mock('@/lib/db/db', () => ({ prisma: {} }));

jest.mock('@/lib/encryption/encryption', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

jest.mock('@/services/issue-provider/registry', () => ({
  getProviderMetadata: (...args: unknown[]) => mockGetProviderMetadata(...args),
}));

import { z } from 'zod';

const githubSchema = z.object({ token: z.string().min(1) });
const jiraSchema = z.object({ baseUrl: z.string().min(1), email: z.string().min(1), apiToken: z.string().min(1) });
const redmineSchema = z.object({ baseUrl: z.string().min(1), apiKey: z.string().min(1) });
const gitlabSchema = z.object({ token: z.string().min(1) });

function setupMeta(type: string) {
  const schemas: Record<string, z.ZodSchema> = {
    GITHUB: githubSchema,
    JIRA: jiraSchema,
    REDMINE: redmineSchema,
    GITLAB: gitlabSchema,
  };
  mockGetProviderMetadata.mockImplementation((t: string) => {
    if (t === type) {
      return { type, credentialSchema: schemas[type] };
    }
    return undefined;
  });
}

beforeEach(() => {
  mockDecrypt.mockReset();
  mockGetProviderMetadata.mockReset();
});

describe('decryptProviderCredentials', () => {
  it('returns GitHub credentials with token', () => {
    setupMeta('GITHUB');
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data', null, 'GITHUB');
    expect(result).toEqual({ token: 'ghp_abc123' });
  });

  it('returns Jira credentials merging baseUrl', () => {
    setupMeta('JIRA');
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'a@b.com', apiToken: 'tok' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://jira.example.com', 'JIRA');
    expect(result).toEqual({ email: 'a@b.com', apiToken: 'tok', baseUrl: 'https://jira.example.com' });
  });

  it('returns Redmine credentials merging baseUrl', () => {
    setupMeta('REDMINE');
    mockDecrypt.mockReturnValue(JSON.stringify({ apiKey: 'key123' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://redmine.example.com', 'REDMINE');
    expect(result).toEqual({ apiKey: 'key123', baseUrl: 'https://redmine.example.com' });
  });

  it('does not add baseUrl property when baseUrl is undefined', () => {
    setupMeta('GITHUB');
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data', undefined, 'GITHUB');
    expect(result).not.toHaveProperty('baseUrl');
  });

  it('does not add baseUrl property when baseUrl is null', () => {
    setupMeta('GITHUB');
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data', null, 'GITHUB');
    expect(result).not.toHaveProperty('baseUrl');
  });

  it('throws when decrypt fails', () => {
    setupMeta('GITHUB');
    mockDecrypt.mockImplementation(() => { throw new Error('decrypt failed'); });
    expect(() => decryptProviderCredentials('bad-data', null, 'GITHUB')).toThrow('decrypt failed');
  });

  it('throws when decrypted text is not valid JSON', () => {
    setupMeta('GITHUB');
    mockDecrypt.mockReturnValue('not-json');
    expect(() => decryptProviderCredentials('encrypted-data', null, 'GITHUB')).toThrow();
  });

  // Shape validation tests
  it('throws when GitHub credentials are missing required token field', () => {
    setupMeta('GITHUB');
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'wrong@field.com' }));
    expect(() => decryptProviderCredentials('encrypted-data', null, 'GITHUB')).toThrow();
  });

  it('throws when Jira credentials are missing required email field', () => {
    setupMeta('JIRA');
    mockDecrypt.mockReturnValue(JSON.stringify({ apiToken: 'tok' }));
    expect(() => decryptProviderCredentials('encrypted-data', 'https://jira.example.com', 'JIRA')).toThrow();
  });

  it('throws when Jira credentials are missing required apiToken field', () => {
    setupMeta('JIRA');
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'a@b.com' }));
    expect(() => decryptProviderCredentials('encrypted-data', 'https://jira.example.com', 'JIRA')).toThrow();
  });

  it('throws when Jira credentials are missing required baseUrl', () => {
    setupMeta('JIRA');
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'a@b.com', apiToken: 'tok' }));
    // No baseUrl passed => mergedCredentials.baseUrl is undefined => Zod should throw
    expect(() => decryptProviderCredentials('encrypted-data', null, 'JIRA')).toThrow();
  });

  it('throws when Redmine credentials are missing required apiKey field', () => {
    setupMeta('REDMINE');
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'wrong' }));
    expect(() => decryptProviderCredentials('encrypted-data', 'https://redmine.example.com', 'REDMINE')).toThrow();
  });

  it('throws when Redmine credentials are missing required baseUrl', () => {
    setupMeta('REDMINE');
    mockDecrypt.mockReturnValue(JSON.stringify({ apiKey: 'key123' }));
    expect(() => decryptProviderCredentials('encrypted-data', null, 'REDMINE')).toThrow();
  });

  it('returns GitLab credentials with token', () => {
    setupMeta('GITLAB');
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'glpat_test123' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://gitlab.com', 'GITLAB');
    expect(result).toEqual({ token: 'glpat_test123' });
  });

  it('does not include baseUrl in GitLab credentials (it is not part of the schema)', () => {
    setupMeta('GITLAB');
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'glpat_test123' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://gitlab.example.com', 'GITLAB');
    expect(result).not.toHaveProperty('baseUrl');
    expect(result).toEqual({ token: 'glpat_test123' });
  });

  it('throws when GitLab credentials are missing required token field', () => {
    setupMeta('GITLAB');
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'wrong@field.com' }));
    expect(() => decryptProviderCredentials('encrypted-data', null, 'GITLAB')).toThrow();
  });

  it('throws for unsupported provider type', () => {
    mockGetProviderMetadata.mockReturnValue(undefined);
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'x' }));
    expect(() => decryptProviderCredentials('encrypted-data', null, 'UNKNOWN')).toThrow('Unsupported provider type: UNKNOWN');
  });
});

describe('buildTypedCredentials', () => {
  it('returns typed GitHubCredentials for GITHUB type', () => {
    setupMeta('GITHUB');
    const result = buildTypedCredentials('GITHUB', { token: 'ghp_test' });
    expect(result).toEqual({ token: 'ghp_test' });
  });

  it('returns typed JiraCredentials for JIRA type', () => {
    setupMeta('JIRA');
    const result = buildTypedCredentials('JIRA', {
      baseUrl: 'https://jira.example.com',
      email: 'a@b.com',
      apiToken: 'tok',
    });
    expect(result).toEqual({ baseUrl: 'https://jira.example.com', email: 'a@b.com', apiToken: 'tok' });
  });

  it('returns typed RedmineCredentials for REDMINE type', () => {
    setupMeta('REDMINE');
    const result = buildTypedCredentials('REDMINE', {
      baseUrl: 'https://redmine.example.com',
      apiKey: 'key123',
    });
    expect(result).toEqual({ baseUrl: 'https://redmine.example.com', apiKey: 'key123' });
  });

  it('throws when GitHub token is missing', () => {
    setupMeta('GITHUB');
    expect(() => buildTypedCredentials('GITHUB', { email: 'wrong@field.com' })).toThrow();
  });

  it('throws when Jira email is missing', () => {
    setupMeta('JIRA');
    expect(() => buildTypedCredentials('JIRA', {
      baseUrl: 'https://jira.example.com',
      apiToken: 'tok',
    })).toThrow();
  });

  it('throws when Redmine apiKey is missing', () => {
    setupMeta('REDMINE');
    expect(() => buildTypedCredentials('REDMINE', {
      baseUrl: 'https://redmine.example.com',
    })).toThrow();
  });

  it('returns typed GitLabCredentials for GITLAB type', () => {
    setupMeta('GITLAB');
    const result = buildTypedCredentials('GITLAB', { token: 'glpat_test' });
    expect(result).toEqual({ token: 'glpat_test' });
  });

  it('throws when GitLab token is missing', () => {
    setupMeta('GITLAB');
    expect(() => buildTypedCredentials('GITLAB', { email: 'wrong@field.com' })).toThrow();
  });

  it('throws for unsupported provider type', () => {
    mockGetProviderMetadata.mockReturnValue(undefined);
    expect(() => buildTypedCredentials('UNKNOWN', { token: 'x' })).toThrow('Unsupported provider type: UNKNOWN');
  });
});
