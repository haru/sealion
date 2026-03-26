import { SyncErrorCause, SyncErrorInfo } from './types';

/**
 * Type guard to check if an error is an AxiosError.
 *
 * @param error - The error to check.
 * @returns True if the error is an AxiosError.
 */
function isAxiosError(error: unknown): error is import('axios').AxiosError {
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
 * Extracts a user-friendly error message from an axios error response.
 *
 * @param error - The axios error to extract from.
 * @returns The extracted message or undefined if none found.
 */
export function extractProviderMessage(error: unknown): string | undefined {
  if (!isAxiosError(error) || !error.response?.data) {
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
 * Creates a structured SyncErrorInfo from an axios error.
 *
 * @param providerName - Name of the provider.
 * @param projectName - Name of the project.
 * @param error - The axios error.
 * @returns Structured error information.
 */
export function createSyncErrorInfo(
  providerName: string,
  projectName: string,
  error: unknown,
): SyncErrorInfo {
  const cause = classifyAxiosError(error);
  const statusCode = isAxiosError(error) ? error.response?.status : undefined;
  const providerMessage = extractProviderMessage(error);
  const technicalMessage = error instanceof Error ? error.message : String(error);

  return {
    providerName,
    projectName,
    cause,
    statusCode,
    providerMessage,
    technicalMessage,
  };
}

/**
 * Formats a SyncErrorInfo into a user-friendly multi-line message
 * for display in MUI notifications.
 *
 * @param errorInfo - The structured error information.
 * @param t - Translation function.
 * @returns Formatted message string with line breaks.
 */
export function formatSyncErrorMessage(
  errorInfo: SyncErrorInfo,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const lines: string[] = [];

  // Header: Provider/Project
  lines.push(`${errorInfo.providerName}: ${errorInfo.projectName}`);

  // Error cause (translated)
  const causeKey = `sync.error.cause.${errorInfo.cause.toLowerCase()}`;
  lines.push(t(causeKey));

  // Provider-specific message (if available)
  if (errorInfo.providerMessage) {
    lines.push(`"${errorInfo.providerMessage}"`);
  }

  // HTTP status code (if available)
  if (errorInfo.statusCode) {
    lines.push(t('sync.error.status', { code: errorInfo.statusCode }));
  }

  return lines.join('\n');
}
