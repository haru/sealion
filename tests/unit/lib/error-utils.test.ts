/** @jest-environment node */
import { describe, it, expect } from '@jest/globals';
import { SyncErrorCause, SyncErrorInfo } from '@/lib/types';
import {
  classifyAxiosError,
  createSyncErrorInfo,
  extractProviderMessage,
  formatSyncErrorMessage,
} from '@/lib/error-utils';

describe('classifyAxiosError', () => {
  it('classifies 401 as AUTHENTICATION', () => {
    const error = createAxiosError({ status: 401 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.AUTHENTICATION);
  });

  it('classifies 403 as AUTHENTICATION', () => {
    const error = createAxiosError({ status: 403 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.AUTHENTICATION);
  });

  it('classifies 429 as RATE_LIMIT', () => {
    const error = createAxiosError({ status: 429 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.RATE_LIMIT);
  });

  it('classifies 404 as NOT_FOUND', () => {
    const error = createAxiosError({ status: 404 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.NOT_FOUND);
  });

  it('classifies 500 as SERVER_ERROR', () => {
    const error = createAxiosError({ status: 500 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.SERVER_ERROR);
  });

  it('classifies 503 as SERVER_ERROR', () => {
    const error = createAxiosError({ status: 503 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.SERVER_ERROR);
  });

  it('classifies 400 as CLIENT_ERROR', () => {
    const error = createAxiosError({ status: 400 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.CLIENT_ERROR);
  });

  it('classifies 422 as CLIENT_ERROR', () => {
    const error = createAxiosError({ status: 422 });
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.CLIENT_ERROR);
  });

  it('classifies network error (no response) as NETWORK_ERROR', () => {
    const error = new Error('ECONNREFUSED') as any;
    error.isAxiosError = true;
    error.response = undefined;
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.NETWORK_ERROR);
  });

  it('classifies unknown error as UNKNOWN', () => {
    const error = new Error('Unknown error');
    expect(classifyAxiosError(error)).toBe(SyncErrorCause.UNKNOWN);
  });
});

describe('createSyncErrorInfo', () => {
  it('creates SyncErrorInfo with provider name', () => {
    const error = createAxiosError({ status: 401, data: { message: 'Bad credentials' } });
    const errorInfo = createSyncErrorInfo('GitHub', 'owner/repo', error);

    expect(errorInfo.providerName).toBe('GitHub');
    expect(errorInfo.projectName).toBe('owner/repo');
    expect(errorInfo.cause).toBe(SyncErrorCause.AUTHENTICATION);
    expect(errorInfo.statusCode).toBe(401);
    expect(errorInfo.providerMessage).toBe('Bad credentials');
  });

  it('captures Jira provider name', () => {
    const error = createAxiosError({ status: 401, data: { errorMessages: ['Authentication failed'] } });
    const errorInfo = createSyncErrorInfo('Jira', 'PROJ-1', error);

    expect(errorInfo.providerName).toBe('Jira');
    expect(errorInfo.projectName).toBe('PROJ-1');
  });

  it('captures Redmine provider name', () => {
    const error = createAxiosError({ status: 401, data: 'Access denied' });
    const errorInfo = createSyncErrorInfo('Redmine', 'test-project', error);

    expect(errorInfo.providerName).toBe('Redmine');
    expect(errorInfo.projectName).toBe('test-project');
  });

  it('handles missing project name', () => {
    const error = createAxiosError({ status: 404 });
    const errorInfo = createSyncErrorInfo('GitHub', '', error);

    expect(errorInfo.projectName).toBe('');
  });

  it('handles network errors with no status code', () => {
    const error = new Error('ECONNREFUSED') as any;
    error.isAxiosError = true;
    error.response = undefined;
    const errorInfo = createSyncErrorInfo('GitHub', 'owner/repo', error);

    expect(errorInfo.statusCode).toBeUndefined();
    expect(errorInfo.cause).toBe(SyncErrorCause.NETWORK_ERROR);
  });

  it('captures technical message', () => {
    const error = createAxiosError({ status: 500 });
    const errorInfo = createSyncErrorInfo('GitHub', 'owner/repo', error);

    expect(errorInfo.technicalMessage).toBe('Axios error');
  });
});

describe('formatSyncErrorMessage', () => {
  // Translation function scoped to the "sync" namespace (relative keys, no "sync." prefix)
  function makeT(overrides: Record<string, string> = {}) {
    return (key: string, params?: Record<string, string | number | Date>) => {
      if (key in overrides) return overrides[key];
      if (key === 'error.cause.authentication') return 'Authentication failed';
      if (key === 'error.cause.rate_limit') return 'Rate limit exceeded';
      if (key === 'error.cause.not_found') return 'Resource not found';
      if (key === 'error.cause.server_error') return 'Server error occurred';
      if (key === 'error.cause.client_error') return 'Invalid request';
      if (key === 'error.cause.network_error') return 'Connection failed';
      if (key === 'error.cause.unknown') return 'Unknown error';
      if (key === 'error.status') return `Status: ${params?.code}`;
      return key;
    };
  }

  it('includes provider name in formatted message', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
      providerMessage: 'Bad credentials',
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    expect(message).toContain('GitHub: owner/repo');
  });

  it('includes project name in formatted message', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    expect(message).toContain('owner/repo');
  });

  it('includes translated error cause', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    expect(message).toContain('Authentication failed');
  });

  it('includes provider message when available', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
      providerMessage: 'Bad credentials',
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    expect(message).toContain('"Bad credentials"');
  });

  it('includes status code when available', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    expect(message).toContain('Status: 401');
  });

  it('omits provider message when not available', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.NETWORK_ERROR,
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    expect(message).not.toContain('"');
  });

  it('omits status code when not available (network error)', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.NETWORK_ERROR,
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    expect(message).not.toContain('Status:');
  });

  it('formats message with line breaks', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
      providerMessage: 'Bad credentials',
    };

    const message = formatSyncErrorMessage(errorInfo, makeT());

    const lines = message.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('GitHub: owner/repo');
    expect(lines[1]).toBe('Authentication failed');
    expect(lines[2]).toBe('"Bad credentials"');
    expect(lines[3]).toBe('Status: 401');
  });
});

describe('extractProviderMessage', () => {
  it('extracts message from GitHub API response', () => {
    const error = createAxiosError({ data: { message: 'Not Found' } });
    expect(extractProviderMessage(error)).toBe('Not Found');
  });

  it('extracts message from Jira API response', () => {
    const error = createAxiosError({
      data: { errorMessages: ['Project not found'] }
    });
    expect(extractProviderMessage(error)).toBe('Project not found');
  });

  it('extracts message from Redmine API response', () => {
    const error = createAxiosError({ data: 'Invalid request' });
    expect(extractProviderMessage(error)).toBe('Invalid request');
  });

  it('truncates long Redmine messages', () => {
    const longMessage = 'A'.repeat(250);
    const error = createAxiosError({ data: longMessage });
    const result = extractProviderMessage(error);
    expect(result).toHaveLength(203); // 200 + '...'
    expect(result).toContain('...');
  });

  it('returns undefined for non-axios errors', () => {
    const error = new Error('Some error');
    expect(extractProviderMessage(error)).toBeUndefined();
  });

  it('returns undefined for errors without data', () => {
    const error = createAxiosError({ data: null });
    expect(extractProviderMessage(error)).toBeUndefined();
  });

  it('falls back to statusText if no message found', () => {
    const error = createAxiosError({ data: {}, statusText: 'Not Found' });
    expect(extractProviderMessage(error)).toBe('Not Found');
  });
});

function createAxiosError({
  status = 500,
  data = null,
  statusText = 'Internal Server Error',
}: { status?: number; data?: unknown; statusText?: string }) {
  const error = new Error('Axios error') as any;
  error.isAxiosError = true;
  error.response = { status, data, statusText };
  return error;
}
