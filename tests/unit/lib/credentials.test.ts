/** @jest-environment node */
import { buildTypedCredentials, decryptProviderCredentials } from '@/lib/credentials';
import { ProviderType } from '@prisma/client';

const mockDecrypt = jest.fn();

jest.mock('@/lib/db', () => ({ prisma: {} }));

jest.mock('@/lib/encryption', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

beforeEach(() => {
  mockDecrypt.mockReset();
});

describe('decryptProviderCredentials', () => {
  it('returns GitHub credentials with token', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data', null, ProviderType.GITHUB);
    expect(result).toEqual({ token: 'ghp_abc123' });
  });

  it('returns Jira credentials merging baseUrl', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'a@b.com', apiToken: 'tok' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://jira.example.com', ProviderType.JIRA);
    expect(result).toEqual({ email: 'a@b.com', apiToken: 'tok', baseUrl: 'https://jira.example.com' });
  });

  it('returns Redmine credentials merging baseUrl', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ apiKey: 'key123' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://redmine.example.com', ProviderType.REDMINE);
    expect(result).toEqual({ apiKey: 'key123', baseUrl: 'https://redmine.example.com' });
  });

  it('does not add baseUrl property when baseUrl is undefined', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data', undefined, ProviderType.GITHUB);
    expect(result).not.toHaveProperty('baseUrl');
  });

  it('does not add baseUrl property when baseUrl is null', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data', null, ProviderType.GITHUB);
    expect(result).not.toHaveProperty('baseUrl');
  });

  it('throws when decrypt fails', () => {
    mockDecrypt.mockImplementation(() => { throw new Error('decrypt failed'); });
    expect(() => decryptProviderCredentials('bad-data', null, ProviderType.GITHUB)).toThrow('decrypt failed');
  });

  it('throws when decrypted text is not valid JSON', () => {
    mockDecrypt.mockReturnValue('not-json');
    expect(() => decryptProviderCredentials('encrypted-data', null, ProviderType.GITHUB)).toThrow();
  });

  // Shape validation tests
  it('throws when GitHub credentials are missing required token field', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'wrong@field.com' }));
    expect(() => decryptProviderCredentials('encrypted-data', null, ProviderType.GITHUB)).toThrow();
  });

  it('throws when Jira credentials are missing required email field', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ apiToken: 'tok' }));
    expect(() => decryptProviderCredentials('encrypted-data', 'https://jira.example.com', ProviderType.JIRA)).toThrow();
  });

  it('throws when Jira credentials are missing required apiToken field', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'a@b.com' }));
    expect(() => decryptProviderCredentials('encrypted-data', 'https://jira.example.com', ProviderType.JIRA)).toThrow();
  });

  it('throws when Jira credentials are missing required baseUrl', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'a@b.com', apiToken: 'tok' }));
    // No baseUrl passed => mergedCredentials.baseUrl is undefined => Zod should throw
    expect(() => decryptProviderCredentials('encrypted-data', null, ProviderType.JIRA)).toThrow();
  });

  it('throws when Redmine credentials are missing required apiKey field', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'wrong' }));
    expect(() => decryptProviderCredentials('encrypted-data', 'https://redmine.example.com', ProviderType.REDMINE)).toThrow();
  });

  it('throws when Redmine credentials are missing required baseUrl', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ apiKey: 'key123' }));
    expect(() => decryptProviderCredentials('encrypted-data', null, ProviderType.REDMINE)).toThrow();
  });
});

describe('buildTypedCredentials', () => {
  it('returns typed GitHubCredentials for GITHUB type', () => {
    const result = buildTypedCredentials(ProviderType.GITHUB, { token: 'ghp_test' });
    expect(result).toEqual({ token: 'ghp_test' });
  });

  it('returns typed JiraCredentials for JIRA type', () => {
    const result = buildTypedCredentials(ProviderType.JIRA, {
      baseUrl: 'https://jira.example.com',
      email: 'a@b.com',
      apiToken: 'tok',
    });
    expect(result).toEqual({ baseUrl: 'https://jira.example.com', email: 'a@b.com', apiToken: 'tok' });
  });

  it('returns typed RedmineCredentials for REDMINE type', () => {
    const result = buildTypedCredentials(ProviderType.REDMINE, {
      baseUrl: 'https://redmine.example.com',
      apiKey: 'key123',
    });
    expect(result).toEqual({ baseUrl: 'https://redmine.example.com', apiKey: 'key123' });
  });

  it('throws when GitHub token is missing', () => {
    expect(() => buildTypedCredentials(ProviderType.GITHUB, { email: 'wrong@field.com' })).toThrow();
  });

  it('throws when Jira email is missing', () => {
    expect(() => buildTypedCredentials(ProviderType.JIRA, {
      baseUrl: 'https://jira.example.com',
      apiToken: 'tok',
    })).toThrow();
  });

  it('throws when Redmine apiKey is missing', () => {
    expect(() => buildTypedCredentials(ProviderType.REDMINE, {
      baseUrl: 'https://redmine.example.com',
    })).toThrow();
  });
});
