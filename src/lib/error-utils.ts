import type { AxiosError } from 'axios';

import { SyncErrorCause, type SyncErrorInfo } from './types';

/**
 * Type guard to check if an error is an AxiosError.
 *
 * @param error - The error to check.
 * @returns True if the error is an AxiosError.
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    (error as Record<string, unknown>).isAxiosError === true
  );
}

/**
 * Classifies an axios error into a user-friendly SyncErrorCause.
 *
 * @param error - The axios error to classify.
 * @returns The classified error cause.
 */
export function classifyAxiosError(error: unknown): SyncErrorCause {
  if (!isAxiosError(error)) {
    return SyncErrorCause.UNKNOWN;
  }

  // Network errors (no response received)
  if (!error.response) {
    return SyncErrorCause.NETWORK_ERROR;
  }

  const status = error.response.status;

  // Authentication/Authorization
  if (status === 401 || status === 403) {
    return SyncErrorCause.AUTHENTICATION;
  }

  // Rate limiting
  if (status === 429) {
    return SyncErrorCause.RATE_LIMIT;
  }

  // Not found
  if (status === 404) {
    return SyncErrorCause.NOT_FOUND;
  }

  // Server errors
  if (status >= 500 && status < 600) {
    return SyncErrorCause.SERVER_ERROR;
  }

  // Other client errors
  if (status >= 400 && status < 500) {
    return SyncErrorCause.CLIENT_ERROR;
  }

  return SyncErrorCause.UNKNOWN;
}

/**
 * Extracts the HTTP status code from an AxiosError, if present.
 *
 * @param error - The error to inspect.
 * @returns The HTTP status code, or `undefined` if the error is not an AxiosError
 *          or has no response (e.g. network error).
 */
export function extractAxiosStatus(error: unknown): number | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }
  return error.response?.status;
}

/**
 * Extracts a user-friendly error message from an axios error response.
 *
 * @param error - The axios error to extract from.
 * @returns The extracted message or undefined if none found.
 */
export function extractProviderMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }

  // No response received (e.g. hpagent proxy CONNECT failure throws Error("Bad response: 403")
  // without populating error.response). Fall back to the error message itself.
  if (!error.response) {
    const msg = typeof error.message === 'string' ? error.message.trim() : '';
    return msg || undefined;
  }

  if (error.response.data == null) {
    return undefined;
  }

  const data = error.response.data;

  // GitHub API: { message: "Not Found", errors: [...] }
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = (data as { message: string }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  // Jira API: { errorMessages: ["..."], errors: {...} }
  if (typeof data === 'object' && data !== null && 'errorMessages' in data) {
    const messages = (data as { errorMessages: string[] }).errorMessages;
    if (Array.isArray(messages) && messages.length > 0) {
      return messages[0];
    }
  }

  // Redmine API: Plain text in response.data
  if (typeof data === 'string' && data.trim().length > 0) {
    return data.length > 200 ? data.slice(0, 200) + '...' : data;
  }

  // Fallback to statusText if available
  return error.response.statusText || undefined;
}

/**
 * Creates a structured SyncErrorInfo suitable for persistence and client display.
 * The `technicalMessage` is intentionally omitted from the returned object to prevent
 * leaking internal error details (e.g. stack traces, credentials) to the client.
 * Callers that need to log the technical detail should do so before calling this function.
 *
 * @param providerName - Name of the provider.
 * @param projectName - Name of the project.
 * @param error - The error thrown during sync.
 * @returns Structured error information safe for persistence and client exposure.
 */
export function createSyncErrorInfo(
  providerName: string,
  projectName: string,
  error: unknown,
): SyncErrorInfo {
  const cause = classifyAxiosError(error);
  const statusCode = isAxiosError(error) ? error.response?.status : undefined;
  const providerMessage = extractProviderMessage(error);

  return {
    providerName,
    projectName,
    cause,
    statusCode,
    providerMessage,
  };
}

/**
 * Parses a SyncErrorInfo stored in a project's syncError DB field.
 *
 * Supports both the current JSON-encoded format and legacy plain-string codes
 * such as "SYNC_FAILED" or "RATE_LIMITED". For legacy values a minimal
 * SyncErrorInfo is synthesised so existing projects still display an appropriate
 * error chip/notification without requiring a re-sync.
 *
 * @param syncError - Raw syncError string from the project record.
 * @returns Parsed SyncErrorInfo, or null if the field is empty.
 */
export function parseSyncErrorInfo(syncError: string | null): SyncErrorInfo | null {
  if (!syncError) {
    return null;
  }

  // First, try to parse the current JSON-encoded format.
  try {
    const parsed = JSON.parse(syncError) as unknown;
    // Only accept objects that look like SyncErrorInfo (must have a "cause" field).
    // If JSON.parse succeeds but the result is not a SyncErrorInfo-shaped object,
    // return null rather than falling through to legacy handling.
    if (parsed !== null && typeof parsed === 'object' && 'cause' in (parsed as object)) {
      return parsed as SyncErrorInfo;
    }
    return null;
  } catch {
    // Not valid JSON — fall through to legacy plain-string handling below.
  }

  // Legacy format: plain string codes such as "SYNC_FAILED" or "RATE_LIMITED".
  const legacyCode = syncError.trim().toUpperCase();
  if (!legacyCode) {
    return null;
  }

  switch (legacyCode) {
    case 'RATE_LIMITED':
      return {
        providerName: '',
        projectName: '',
        cause: SyncErrorCause.RATE_LIMIT,
      };
    case 'SYNC_FAILED':
      return {
        providerName: '',
        projectName: '',
        cause: SyncErrorCause.UNKNOWN,
      };
    default:
      return {
        providerName: '',
        projectName: '',
        cause: SyncErrorCause.UNKNOWN,
      };
  }
}

/**
 * Structured details of a failed provider connection test, safe for client exposure.
 * Mirrors the relevant subset of {@link SyncErrorInfo} but without provider/project context.
 */
export interface ConnectionTestErrorDetails {
  /** Classified reason for the failure. */
  cause: SyncErrorCause;
  /** HTTP status code returned by the provider, if available. */
  statusCode?: number;
  /** User-facing message from the provider response, if available. */
  providerMessage?: string;
}

/**
 * Creates {@link ConnectionTestErrorDetails} from an error thrown during `testConnection()`.
 *
 * @param error - The error thrown by the adapter.
 * @returns Structured error details safe for client exposure.
 */
export function createConnectionTestErrorDetails(error: unknown): ConnectionTestErrorDetails {
  const cause = classifyAxiosError(error);
  const statusCode = isAxiosError(error) ? error.response?.status : undefined;
  const providerMessage = extractProviderMessage(error);
  return { cause, statusCode, providerMessage };
}

/** Maps each SyncErrorCause to its translation key, relative to the "sync" namespace. */
const CAUSE_KEY_MAP: Record<SyncErrorCause, string> = {
  [SyncErrorCause.AUTHENTICATION]: 'error.cause.authentication',
  [SyncErrorCause.RATE_LIMIT]: 'error.cause.rate_limit',
  [SyncErrorCause.NOT_FOUND]: 'error.cause.not_found',
  [SyncErrorCause.SERVER_ERROR]: 'error.cause.server_error',
  [SyncErrorCause.CLIENT_ERROR]: 'error.cause.client_error',
  [SyncErrorCause.NETWORK_ERROR]: 'error.cause.network_error',
  [SyncErrorCause.UNKNOWN]: 'error.cause.unknown',
};

/**
 * Formats a SyncErrorInfo into a user-friendly multi-line message
 * for display in MUI notifications.
 *
 * @param errorInfo - The structured error information.
 * @param t - Translation function scoped to the "sync" namespace.
 * @returns Formatted message string with newline separators.
 */
export function formatSyncErrorMessage(
  errorInfo: SyncErrorInfo,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
): string {
  const lines: string[] = [];

  // Header: Provider/Project
  lines.push(`${errorInfo.providerName}: ${errorInfo.projectName}`);

  // Error cause (translated)
  lines.push(t(CAUSE_KEY_MAP[errorInfo.cause]));

  // Provider-specific message (if available)
  if (errorInfo.providerMessage) {
    lines.push(`"${errorInfo.providerMessage}"`);
  }

  // HTTP status code (if available)
  if (errorInfo.statusCode) {
    lines.push(t('error.status', { code: errorInfo.statusCode }));
  }

  return lines.join('\n');
}

/**
 * Formats {@link ConnectionTestErrorDetails} into a user-friendly multi-line message
 * for display in a form Alert when a provider connection test fails.
 * Unlike {@link formatSyncErrorMessage}, this omits the provider/project header
 * since that context is not available during initial provider creation.
 *
 * @param details - The structured connection test error details.
 * @param t - Translation function scoped to the "sync" namespace.
 * @returns Formatted message string with newline separators.
 */
export function formatConnectionTestError(
  details: ConnectionTestErrorDetails,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
): string {
  const lines: string[] = [];
  lines.push(t(CAUSE_KEY_MAP[details.cause]));
  if (details.providerMessage) {
    lines.push(`"${details.providerMessage}"`);
  }
  if (details.statusCode) {
    lines.push(t('error.status', { code: details.statusCode }));
  }
  return lines.join('\n');
}

/**
 * Shape of a JSON response body returned by provider API routes on error.
 */
export interface ProviderApiErrorResponse {
  error?: string | null;
  errorDetails?: ConnectionTestErrorDetails | unknown;
}

/**
 * Extracts a user-friendly error message from a provider API error response.
 * Handles the special `CONNECTION_TEST_FAILED` code with structured details,
 * falling back to the raw error string or a supplied default.
 *
 * @param json - The parsed JSON response from the provider API.
 * @param tSync - Translation function scoped to the "sync" namespace.
 * @param fallbackMessage - Default message when no error information is available.
 * @returns A formatted error message string safe for display.
 */
export function formatProviderApiError(
  json: ProviderApiErrorResponse,
  tSync: (key: string, params?: Record<string, string | number | Date>) => string,
  fallbackMessage: string,
): string {
  if (
    json.error === 'CONNECTION_TEST_FAILED' &&
    json.errorDetails != null &&
    typeof json.errorDetails === 'object' &&
    'cause' in (json.errorDetails as object)
  ) {
    return formatConnectionTestError(json.errorDetails as ConnectionTestErrorDetails, tSync);
  }
  if (json.error === 'CONNECTION_TEST_FAILED') {
    return fallbackMessage;
  }
  return json.error ?? fallbackMessage;
}

