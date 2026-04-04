/**
 * All valid message severity type values. This is the single source of truth
 * used for both the `MessageType` union and runtime validation.
 */
export const MESSAGE_TYPES = ['information', 'warning', 'error'] as const;

/**
 * Message severity types for user notifications.
 */
export type MessageType = (typeof MESSAGE_TYPES)[number];

/**
 * Message Queue Context
 */
export interface MessageQueueContextType {
  messages: MessageData[];
  addMessage: (type: MessageType, message: string) => void;
  dismissMessage: (id: string) => void;
  /**
   * Dismisses all active messages and clears the pending queue.
   * Note: queued (not-yet-displayed) messages are also discarded.
   */
  closeAllMessages: () => void;
}

/**
 * Data structure for a single message notification.
 *
 * - `id`: Unique identifier for message (used for dismissal)
 * - `type`: Severity level of message
 * - `message`: The text content to display to user
 * - `timestamp`: Unix timestamp when message was queued (for throttle logic)
 */
export interface MessageData {
  id: string;
  type: MessageType;
  message: string;
  timestamp: number;
}

/**
 * Auto-dismiss duration in milliseconds for each message type.
 *
 * - Information: 6000ms (6 seconds) per FR-005
 * - Warning: 6000ms (6 seconds) per FR-005
 * - Error: null (no auto-dismiss) per FR-005
 */
export const AUTO_DISMISS_DURATION: Record<MessageType, number | null> = {
  information: 6000,
  warning: 6000,
  error: null,
};

/**
 * Display constraints for message queue.
 *
 * - `maxMessages`: Maximum concurrent messages (FR-006)
 * - `minIntervalMs`: Minimum time between messages in milliseconds (FR-009)
 * - `displayPosition`: Screen position for messages (FR-002)
 */
export const DISPLAY_CONSTRAINTS = {
  maxMessages: 5,
  minIntervalMs: 500,
  displayPosition: { vertical: 'top', horizontal: 'center' } as const,
} as const;

/**
 * Validates a value as a MessageData object.
 *
 * @param message - The value to validate
 * @returns true if the value is a valid MessageData, false otherwise
 */
export function isValidMessage(message: unknown): message is MessageData {
  if (typeof message !== 'object' || message === null) { return false; }
  const m = message as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    m.id.length > 0 &&
    (MESSAGE_TYPES as readonly string[]).includes(m.type as string) &&
    typeof m.message === 'string' &&
    m.message.length > 0 &&
    typeof m.timestamp === 'number' &&
    m.timestamp > 0
  );
}

/**
 * Checks if a string is a valid MessageType.
 *
 * @param type - The type string to check
 * @returns true if valid MessageType, false otherwise
 */
export function isValidMessageType(type: string): type is MessageType {
  return (MESSAGE_TYPES as readonly string[]).includes(type);
}
