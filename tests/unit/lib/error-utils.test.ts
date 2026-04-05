/** @jest-environment node */
import { describe, it, expect } from '@jest/globals';
import { SyncErrorCause, SyncErrorInfo } from '@/lib/types';
import {
  classifyAxiosError,
  createSyncErrorInfo,
  extractAxiosStatus,
  extractProviderMessage,
  formatConnectionTestError,
  formatProviderApiError,
  formatSyncErrorMessage,
  parseSyncErrorInfo,
} from '@/lib/sync/error-utils';
import type { ConnectionTestErrorDetails } from '@/lib/sync/error-utils';

describe('parseSyncErrorInfo', () => {
  it('returns null for null input', () => {
    expect(parseSyncErrorInfo(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSyncErrorInfo('')).toBeNull();
  });

  it('parses valid JSON-encoded SyncErrorInfo', () => {
    const info: SyncErrorInfo = {
      providerName: 'GitHub',
      projectName: 'owner/repo',
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };
    const result = parseSyncErrorInfo(JSON.stringify(info));
    expect(result).not.toBeNull();
    expect(result!.cause).toBe(SyncErrorCause.AUTHENTICATION);
    expect(result!.providerName).toBe('GitHub');
    expect(result!.projectName).toBe('owner/repo');
    expect(result!.statusCode).toBe(401);
  });

  it('maps legacy "RATE_LIMITED" string to RATE_LIMIT cause', () => {
    const result = parseSyncErrorInfo('RATE_LIMITED');
    expect(result).not.toBeNull();
    expect(result!.cause).toBe(SyncErrorCause.RATE_LIMIT);
  });

  it('maps legacy "SYNC_FAILED" string to UNKNOWN cause', () => {
    const result = parseSyncErrorInfo('SYNC_FAILED');
    expect(result).not.toBeNull();
    expect(result!.cause).toBe(SyncErrorCause.UNKNOWN);
  });

  it('maps any unrecognized non-JSON string to UNKNOWN cause', () => {
    const result = parseSyncErrorInfo('SOME_OLD_ERROR_CODE');
    expect(result).not.toBeNull();
    expect(result!.cause).toBe(SyncErrorCause.UNKNOWN);
  });

  it('returns null for valid JSON that is not a SyncErrorInfo object', () => {
    // Plain JSON values without a "cause" field should not be treated as SyncErrorInfo
    expect(parseSyncErrorInfo('"just a string"')).toBeNull();
    expect(parseSyncErrorInfo('42')).toBeNull();
    expect(parseSyncErrorInfo('{"foo":"bar"}')).toBeNull();
  });
});

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
    const error = new Error('ECONNREFUSED') as Record<string, unknown>;
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
    const error = new Error('ECONNREFUSED') as Record<string, unknown>;
    error.isAxiosError = true;
    error.response = undefined;
    const errorInfo = createSyncErrorInfo('GitHub', 'owner/repo', error);

    expect(errorInfo.statusCode).toBeUndefined();
    expect(errorInfo.cause).toBe(SyncErrorCause.NETWORK_ERROR);
  });

  it('does not include technicalMessage in returned SyncErrorInfo', () => {
    // technicalMessage must be stripped before the object is persisted / sent to the client
    // to avoid leaking internal error details. Callers log it server-side instead.
    const error = createAxiosError({ status: 500 });
    const errorInfo = createSyncErrorInfo('GitHub', 'owner/repo', error);

    expect(errorInfo).not.toHaveProperty('technicalMessage');
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

  it('returns error message when axios error has no response (e.g. proxy CONNECT failure)', () => {
    // hpagent throws Error("Bad response: 403") when proxy rejects CONNECT;
    // there is no error.response, so we fall back to error.message.
    const error = new Error('Bad response: 403') as Record<string, unknown>;
    error.isAxiosError = true;
    error.response = undefined;
    expect(extractProviderMessage(error)).toBe('Bad response: 403');
  });

  it('returns undefined when axios error has no response and empty message', () => {
    const error = new Error('') as Record<string, unknown>;
    error.isAxiosError = true;
    error.response = undefined;
    expect(extractProviderMessage(error)).toBeUndefined();
  });

  it('falls back to statusText if no message found', () => {
    const error = createAxiosError({ data: {}, statusText: 'Not Found' });
    expect(extractProviderMessage(error)).toBe('Not Found');
  });

  it('falls back to statusText when data is an empty string', () => {
    // An empty string is falsy but not null/undefined — the fallback must still apply
    const error = createAxiosError({ data: '', statusText: 'Bad Request' });
    expect(extractProviderMessage(error)).toBe('Bad Request');
  });

  it('returns undefined when data is an empty string and statusText is empty', () => {
    const error = createAxiosError({ data: '', statusText: '' });
    expect(extractProviderMessage(error)).toBeUndefined();
  });
});

describe('formatConnectionTestError', () => {
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

  it('includes translated cause', () => {
    const details: ConnectionTestErrorDetails = {
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };
    const message = formatConnectionTestError(details, makeT());
    expect(message).toContain('Authentication failed');
  });

  it('includes provider message when present', () => {
    const details: ConnectionTestErrorDetails = {
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
      providerMessage: 'Bad credentials',
    };
    const message = formatConnectionTestError(details, makeT());
    expect(message).toContain('"Bad credentials"');
  });

  it('includes status code when present', () => {
    const details: ConnectionTestErrorDetails = {
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
    };
    const message = formatConnectionTestError(details, makeT());
    expect(message).toContain('Status: 401');
  });

  it('omits provider message when not present', () => {
    const details: ConnectionTestErrorDetails = {
      cause: SyncErrorCause.NETWORK_ERROR,
    };
    const message = formatConnectionTestError(details, makeT());
    expect(message).not.toContain('"');
  });

  it('omits status code when not present', () => {
    const details: ConnectionTestErrorDetails = {
      cause: SyncErrorCause.NETWORK_ERROR,
    };
    const message = formatConnectionTestError(details, makeT());
    expect(message).not.toContain('Status:');
  });

  it('formats full message with newlines', () => {
    const details: ConnectionTestErrorDetails = {
      cause: SyncErrorCause.AUTHENTICATION,
      statusCode: 401,
      providerMessage: 'Bad credentials',
    };
    const message = formatConnectionTestError(details, makeT());
    const lines = message.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Authentication failed');
    expect(lines[1]).toBe('"Bad credentials"');
    expect(lines[2]).toBe('Status: 401');
  });
});

describe('formatProviderApiError', () => {
  function makeT(overrides: Record<string, string> = {}) {
    return (key: string, params?: Record<string, string | number | Date>) => {
      if (key in overrides) return overrides[key];
      if (key === 'error.cause.authentication') return 'Authentication failed';
      if (key === 'error.cause.network_error') return 'Connection failed';
      if (key === 'error.cause.unknown') return 'Unknown error';
      return key;
    };
  }

  it('returns formatted connection test error when error is CONNECTION_TEST_FAILED with details', () => {
    const json = { error: 'CONNECTION_TEST_FAILED', errorDetails: { cause: SyncErrorCause.AUTHENTICATION, statusCode: 401 } };
    const result = formatProviderApiError(json, makeT(), 'Default error');
    expect(result).toContain('Authentication failed');
  });

  it('returns json.error when error is not CONNECTION_TEST_FAILED', () => {
    const json = { error: 'SOME_OTHER_ERROR' };
    const result = formatProviderApiError(json, makeT(), 'Default error');
    expect(result).toBe('SOME_OTHER_ERROR');
  });

  it('returns fallback when error is null', () => {
    const json = { error: null };
    const result = formatProviderApiError(json, makeT(), 'Default error');
    expect(result).toBe('Default error');
  });

  it('returns fallback when json.error is undefined', () => {
    const json = {};
    const result = formatProviderApiError(json, makeT(), 'Default error');
    expect(result).toBe('Default error');
  });

  it('returns fallback when errorDetails has no cause field', () => {
    const json = { error: 'CONNECTION_TEST_FAILED', errorDetails: { foo: 'bar' } };
    const result = formatProviderApiError(json, makeT(), 'Default error');
    expect(result).toBe('Default error');
  });
});

describe('extractAxiosStatus', () => {
  it('returns status code from an AxiosError with response', () => {
    const error = createAxiosError({ status: 403 });
    expect(extractAxiosStatus(error)).toBe(403);
  });

  it('returns undefined for an AxiosError without response (network error)', () => {
    const error = new Error('ECONNREFUSED') as Record<string, unknown>;
    error.isAxiosError = true;
    error.response = undefined;
    expect(extractAxiosStatus(error)).toBeUndefined();
  });

  it('returns undefined for a plain Error', () => {
    const error = new Error('plain error');
    expect(extractAxiosStatus(error)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(extractAxiosStatus(null)).toBeUndefined();
  });

  it('returns undefined for a string', () => {
    expect(extractAxiosStatus('some error string')).toBeUndefined();
  });
});

function createAxiosError({
  status = 500,
  data = null,
  statusText = 'Internal Server Error',
}: { status?: number; data?: unknown; statusText?: string }) {
  const error = new Error('Axios error') as Record<string, unknown>;
  error.isAxiosError = true;
  error.response = { status, data, statusText };
  return error;
}
