'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { MessageData, MessageQueueContextType, MessageType, DISPLAY_CONSTRAINTS, isValidMessage, isValidMessageType } from './types';
import { addMessage, dismissMessage as dismissMessageUtil, closeAllMessages as closeAllMessagesUtil, processQueue } from '@/lib/message-queue';
import MessageSnackbar from './MessageSnackbar';

/**
 * Message Queue Context
 */
const MessageQueueContext = createContext<MessageQueueContextType | undefined>(undefined);

/**
 * Message Queue Provider Props
 */
interface MessageQueueProviderProps {
  children: ReactNode;
}

/**
 * Internal queue state combining all related state fields.
 */
interface QueueState {
  messages: MessageData[];
  queue: MessageData[];
  lastMessageTime: number | null;
}

/**
 * Message Queue Provider Component
 *
 * Manages message queue state and provides API for adding/dismissing messages.
 * Renders messages using MessageSnackbar components.
 *
 * @param props - Provider props with children
 */
export function MessageQueueProvider({ children }: MessageQueueProviderProps) {
  const idCounter = useRef(0);
  const [state, setState] = useState<QueueState>({
    messages: [],
    queue: [],
    lastMessageTime: null,
  });

  /**
   * Process pending queue messages when throttle interval allows.
   * This effect runs whenever queue state changes.
   */
  useEffect(() => {
    if (state.queue.length === 0 || state.messages.length >= DISPLAY_CONSTRAINTS.maxMessages) {
      return;
    }

    const timer = setTimeout(() => {
      setState(prev => processQueue(prev));
    }, DISPLAY_CONSTRAINTS.minIntervalMs);

    return () => clearTimeout(timer);
  }, [state.queue, state.messages]);

  /**
   * Adds a message to the queue.
   *
   * @param type - Message severity type
   * @param message - Message text to display
   */
  const addMessageAction = useCallback((type: MessageType, message: string) => {
    if (!isValidMessageType(type)) {
      console.warn(`Invalid message type: ${type}`);
      return;
    }

    if (!message || message.trim() === '') {
      console.warn('Message text cannot be empty');
      return;
    }

    const now = Date.now();
    const newMessage: MessageData = {
      id: `msg-${now}-${++idCounter.current}`,
      type,
      message: message.trim(),
      timestamp: now,
    };

    if (!isValidMessage(newMessage)) {
      console.warn('Invalid message data');
      return;
    }

    setState(prev => addMessage(prev.messages, prev.queue, prev.lastMessageTime, newMessage));
  }, []);

  /**
   * Dismisses a message by ID.
   *
   * @param id - ID of message to dismiss
   */
  const dismissMessageAction = useCallback((id: string) => {
    setState(prev => {
      const messageExists =
        prev.messages.some(msg => msg.id === id) ||
        prev.queue.some(msg => msg.id === id);

      if (!messageExists) {
        console.warn(`Invalid message ID or message not found: ${id}`);
        return prev;
      }

      return dismissMessageUtil(prev.messages, prev.queue, prev.lastMessageTime, id);
    });
  }, []);

  /**
   * Dismisses all active messages.
   */
  const closeAllMessagesAction = useCallback(() => {
    setState(closeAllMessagesUtil());
  }, []);

  const contextValue: MessageQueueContextType = {
    messages: state.messages,
    addMessage: addMessageAction,
    dismissMessage: dismissMessageAction,
    closeAllMessages: closeAllMessagesAction,
  };

  return (
    <MessageQueueContext.Provider value={contextValue}>
      {children}
      {state.messages.map((message) => (
        <MessageSnackbar
          key={message.id}
          message={message}
          onClose={dismissMessageAction}
        />
      ))}
    </MessageQueueContext.Provider>
  );
}

/**
 * Hook for accessing message queue functionality.
 *
 * @returns Message queue context with messages array and actions
 * @throws Error if used outside MessageQueueProvider
 */
export const useMessageQueue = (): MessageQueueContextType => {
  const context = useContext(MessageQueueContext);

  if (!context) {
    throw new Error('useMessageQueue must be used within a MessageQueueProvider');
  }

  return context;
};

export default MessageQueueProvider;
