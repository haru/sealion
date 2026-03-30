/** @jest-environment node */
import { decryptProviderCredentials } from '@/lib/credentials';

const mockDecrypt = jest.fn();

jest.mock('@/lib/encryption', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

beforeEach(() => {
  mockDecrypt.mockReset();
});

describe('decryptProviderCredentials', () => {
  it('returns GitHub credentials with token', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data');
    expect(result).toEqual({ token: 'ghp_abc123' });
  });

  it('returns Jira credentials merging baseUrl', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ email: 'a@b.com', apiToken: 'tok' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://jira.example.com');
    expect(result).toEqual({ email: 'a@b.com', apiToken: 'tok', baseUrl: 'https://jira.example.com' });
  });

  it('returns Redmine credentials merging baseUrl', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ apiKey: 'key123' }));
    const result = decryptProviderCredentials('encrypted-data', 'https://redmine.example.com');
    expect(result).toEqual({ apiKey: 'key123', baseUrl: 'https://redmine.example.com' });
  });

  it('does not add baseUrl property when baseUrl is undefined', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data');
    expect(result).not.toHaveProperty('baseUrl');
  });

  it('does not add baseUrl property when baseUrl is null', () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ token: 'ghp_abc123' }));
    const result = decryptProviderCredentials('encrypted-data', null);
    expect(result).not.toHaveProperty('baseUrl');
  });

  it('throws when decrypt fails', () => {
    mockDecrypt.mockImplementation(() => { throw new Error('decrypt failed'); });
    expect(() => decryptProviderCredentials('bad-data')).toThrow('decrypt failed');
  });

  it('throws when decrypted text is not valid JSON', () => {
    mockDecrypt.mockReturnValue('not-json');
    expect(() => decryptProviderCredentials('encrypted-data')).toThrow();
  });
});
