/** @jest-environment node */
import { describe, it, expect } from '@jest/globals';
import { SyncErrorCause } from '@/lib/types';
import { classifyAxiosError, createSyncErrorInfo, formatSyncErrorMessage } from '@/lib/error-utils';

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
  it('includes provider name in formatted message', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
      providerMessage: 'Bad credentials',
    };
    const t = (key: string, params?: Record<string, unknown>) => {
      if (key === 'sync.error.cause.authentication') return 'Authentication failed';
      if (key === 'sync.error.status') return `Status: ${params?.code}`;
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

    expect(message).toContain('GitHub: owner/repo');
  });

  it('includes project name in formatted message', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };
    const t = (key: string) => {
      if (key === 'sync.error.cause.authentication') return 'Authentication failed';
      if (key === 'sync.error.status') return 'Status: 401';
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

    expect(message).toContain('owner/repo');
  });

  it('includes translated error cause', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };
    const t = (key: string) => {
      if (key === 'sync.error.cause.authentication') return 'Authentication failed';
      if (key === 'sync.error.status') return 'Status: 401';
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

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
    const t = (key: string) => {
      if (key === 'sync.error.cause.authentication') return 'Authentication failed';
      if (key === 'sync.error.status') return 'Status: 401';
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

    expect(message).toContain('"Bad credentials"');
  });

  it('includes status code when available', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };
    const t = (key: string) => {
      if (key === 'sync.error.cause.authentication') return 'Authentication failed';
      if (key === 'sync.error.status') return 'Status: 401';
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

    expect(message).toContain('Status: 401');
  });

  it('omits provider message when not available', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.NETWORK_ERROR,
    };
    const t = (key: string) => {
      if (key === 'sync.error.cause.network_error') return 'Connection failed';
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

    expect(message).not.toContain('"');
  });

  it('omits status code when not available (network error)', () => {
    const errorInfo: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.NETWORK_ERROR,
    };
    const t = (key: string) => {
      if (key === 'sync.error.cause.network_error') return 'Connection failed';
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

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
    const t = (key: string) => {
      if (key === 'sync.error.cause.authentication') return 'Authentication failed';
      if (key === 'sync.error.status') return 'Status: 401';
      return key;
    };

    const message = formatSyncErrorMessage(errorInfo, t);

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
    const { extractProviderMessage } = require('@/lib/error-utils');
    expect(extractProviderMessage(error)).toBe('Not Found');
  });

  it('extracts message from Jira API response', () => {
    const error = createAxiosError({
      data: { errorMessages: ['Project not found'] }
    });
    const { extractProviderMessage } = require('@/lib/error-utils');
    expect(extractProviderMessage(error)).toBe('Project not found');
  });

  it('extracts message from Redmine API response', () => {
    const error = createAxiosError({ data: 'Invalid request' });
    const { extractProviderMessage } = require('@/lib/error-utils');
    expect(extractProviderMessage(error)).toBe('Invalid request');
  });

  it('truncates long Redmine messages', () => {
    const longMessage = 'A'.repeat(250);
    const error = createAxiosError({ data: longMessage });
    const { extractProviderMessage } = require('@/lib/error-utils');
    const result = extractProviderMessage(error);
    expect(result).toHaveLength(203); // 200 + '...'
    expect(result).toContain('...');
  });

  it('returns undefined for non-axios errors', () => {
    const error = new Error('Some error');
    const { extractProviderMessage } = require('@/lib/error-utils');
    expect(extractProviderMessage(error)).toBeUndefined();
  });

  it('returns undefined for errors without data', () => {
    const error = createAxiosError({ data: null });
    const { extractProviderMessage } = require('@/lib/error-utils');
    expect(extractProviderMessage(error)).toBeUndefined();
  });

  it('falls back to statusText if no message found', () => {
    const error = createAxiosError({ data: {}, statusText: 'Not Found' });
    const { extractProviderMessage } = require('@/lib/error-utils');
    expect(extractProviderMessage(error)).toBe('Not Found');
  });
});

function createAxiosError({
  status = 500,
  data = null,
  statusText = 'Internal Server Error',
}: any) {
  const error = new Error('Axios error') as any;
  error.isAxiosError = true;
  error.response = { status, data, statusText };
  return error;
}
