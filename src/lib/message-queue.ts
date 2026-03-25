import { MessageData, DISPLAY_CONSTRAINTS } from '@/components/types';

/**
 * Adds a message to the queue or pending queue based on throttle interval.
 *
 * @param messages - Current active messages array
 * @param queue - Pending messages waiting for throttle interval
 * @param lastMessageTime - Timestamp of last displayed message
 * @param message - The message data to add
 * @returns Updated state with message added or queued
 */
export const addMessage = (
  messages: MessageData[],
  queue: MessageData[],
  lastMessageTime: number | null,
  message: MessageData,
): { messages: MessageData[]; queue: MessageData[]; lastMessageTime: number | null } => {
  const timeSinceLastMessage = lastMessageTime ? message.timestamp - lastMessageTime : DISPLAY_CONSTRAINTS.minIntervalMs;

  // Check throttle interval
  if (timeSinceLastMessage < DISPLAY_CONSTRAINTS.minIntervalMs) {
    // Throttled: add to pending queue
    return {
      messages,
      queue: [...queue, message],
      lastMessageTime,
    };
  }

  // Check max messages limit
  if (messages.length >= DISPLAY_CONSTRAINTS.maxMessages) {
    // Remove oldest message to make room
    const updatedMessages = [...messages.slice(1), message];

    return {
      messages: updatedMessages,
      queue,
      lastMessageTime: message.timestamp,
    };
  }

  // Add message directly
  return {
    messages: [...messages, message],
    queue,
    lastMessageTime: message.timestamp,
  };
};

/**
 * Dismisses a message by ID and processes pending queue.
 *
 * @param messages - Current active messages array
 * @param queue - Pending messages waiting for throttle interval
 * @param lastMessageTime - Timestamp of last displayed message
 * @param messageId - The ID of message to dismiss
 * @returns Updated state with message removed and queue processed
 */
export const dismissMessage = (
  messages: MessageData[],
  queue: MessageData[],
  lastMessageTime: number | null,
  messageId: string,
): { messages: MessageData[]; queue: MessageData[]; lastMessageTime: number | null } => {
  const updatedMessages = messages.filter(msg => msg.id !== messageId);

  // Process pending queue after a delay to respect throttle interval
  setTimeout(() => {
    const nextMessage = queue.shift();
    if (nextMessage) {
      return {
        messages: [...updatedMessages, nextMessage],
        queue,
        lastMessageTime: Date.now(),
      };
    }
  }, DISPLAY_CONSTRAINTS.minIntervalMs);

  return {
    messages: updatedMessages,
    queue,
    lastMessageTime,
  };
};

/**
 * Dismisses all active messages.
 *
 * @returns Empty state
 */
export const closeAllMessages = (): {
  messages: MessageData[];
  queue: MessageData[];
  lastMessageTime: number | null;
} => {
  return {
    messages: [],
    queue: [],
    lastMessageTime: null,
  };
};

/**
 * Processes pending queue messages when throttle interval allows.
 * This is called after a message is added or dismissed.
 *
 * @param state - Current queue state
 * @returns Updated state with message moved from queue to messages
 */
export const processQueue = (
  state: { messages: MessageData[]; queue: MessageData[]; lastMessageTime: number | null },
): { messages: MessageData[]; queue: MessageData[]; lastMessageTime: number | null } => {
  if (state.queue.length === 0 || state.messages.length >= DISPLAY_CONSTRAINTS.maxMessages) {
    return state;
  }

  const nextMessage = state.queue[0];
  if (!nextMessage) {
    return state;
  }

  return {
    messages: [...state.messages, nextMessage],
    queue: state.queue.slice(1),
    lastMessageTime: state.lastMessageTime,
  };
};
