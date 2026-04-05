import { MessageData, MessageType, AUTO_DISMISS_DURATION, DISPLAY_CONSTRAINTS } from '@/components/types';
import { addMessage, dismissMessage, closeAllMessages, processQueue } from '@/lib/ui/message-queue';

describe('message-queue - addMessage', () => {
  it('adds message when under max limit', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: null,
    };

    const result = addMessage(
      state.messages,
      state.queue,
      state.lastMessageTime,
      { id: '1', type: 'information', message: 'Test', timestamp: Date.now() },
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe('1');
  });

  it('removes oldest message when max limit reached', () => {
    const existingMessages: MessageData[] = [
      { id: '1', type: 'information', message: 'Msg 1', timestamp: 1 },
      { id: '2', type: 'information', message: 'Msg 2', timestamp: 2 },
      { id: '3', type: 'information', message: 'Msg 3', timestamp: 3 },
      { id: '4', type: 'information', message: 'Msg 4', timestamp: 4 },
      { id: '5', type: 'information', message: 'Msg 5', timestamp: 5 },
    ];

    const state = {
      messages: existingMessages,
      queue: [],
      lastMessageTime: 5000,
    };

    const newMessage = { id: '6', type: 'information', message: 'New', timestamp: 6000 };

    const result = addMessage(
      state.messages,
      state.queue,
      state.lastMessageTime,
      newMessage,
    );

    expect(result.messages).toHaveLength(5);
    expect(result.messages).not.toContainEqual(existingMessages[0]);
    expect(result.messages).toContainEqual(existingMessages[1]);
  });

  it('queues message when throttle interval not met', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: 4500,
    };

    const newMessage = { id: '1', type: 'information', message: 'Test', timestamp: 4950 };

    const result = addMessage(
      state.messages,
      state.queue,
      state.lastMessageTime,
      newMessage,
    );

    expect(result.queue).toHaveLength(1);
    expect(result.queue[0]).toEqual(newMessage);
    expect(result.messages).toHaveLength(0);
  });

  it('queues message when throttle interval is met', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: 4500,
    };

    const newMessage = { id: '1', type: 'information', message: 'Test', timestamp: 5000 };

    const result = addMessage(
      state.messages,
      state.queue,
      state.lastMessageTime,
      newMessage,
    );

    expect(result.queue).toHaveLength(0);
    expect(result.messages).toHaveLength(1);
  });
});

describe('message-queue - dismissMessage', () => {
  it('removes message by id', () => {
    const messages: MessageData[] = [
      { id: '1', type: 'information', message: 'Msg 1', timestamp: 1 },
      { id: '2', type: 'warning', message: 'Msg 2', timestamp: 2 },
    ];

    const result = dismissMessage(
      messages,
      [],
      null,
      '1',
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe('2');
  });

  it('returns unchanged state if message id not found', () => {
    const messages: MessageData[] = [
      { id: '1', type: 'information', message: 'Msg 1', timestamp: 1 },
    ];

    const result = dismissMessage(
      messages,
      [],
      null,
      'non-existent',
    );

    expect(result.messages).toEqual(messages);
  });

  it('also removes a matching id from the pending queue', () => {
    // A queued message can be dismissed before it becomes visible.
    // dismissMessage must filter both messages and queue so the
    // message is never promoted to visible after dismissal.
    const messages: MessageData[] = [
      { id: '1', type: 'information', message: 'Active', timestamp: 1 },
    ];
    const queue: MessageData[] = [
      { id: '2', type: 'warning', message: 'Queued', timestamp: 2 },
      { id: '3', type: 'error', message: 'Also queued', timestamp: 3 },
    ];

    const result = dismissMessage(messages, queue, null, '2');

    expect(result.messages).toHaveLength(1);
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0].id).toBe('3');
  });

  it('leaves queue unchanged when dismissed id is only in messages', () => {
    const messages: MessageData[] = [
      { id: '1', type: 'information', message: 'Active', timestamp: 1 },
    ];
    const queue: MessageData[] = [
      { id: '2', type: 'warning', message: 'Queued', timestamp: 2 },
    ];

    const result = dismissMessage(messages, queue, null, '1');

    expect(result.messages).toHaveLength(0);
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0].id).toBe('2');
  });
});

describe('message-queue - closeAllMessages', () => {
  it('clears all messages', () => {
    const messages: MessageData[] = [
      { id: '1', type: 'information', message: 'Msg 1', timestamp: 1 },
      { id: '2', type: 'warning', message: 'Msg 2', timestamp: 2 },
      { id: '3', type: 'error', message: 'Msg 3', timestamp: 3 },
    ];

    const result = closeAllMessages();

    expect(result.messages).toHaveLength(0);
    expect(result.queue).toHaveLength(0);
  });
});

describe('message-queue - processQueue', () => {
  it('moves message from queue to messages', () => {
    const state = {
      messages: [],
      queue: [{ id: '1', type: 'information', message: 'Queued', timestamp: 1 }],
      lastMessageTime: 4500,
    };

    const result = processQueue(state);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual(state.queue[0]);
    expect(result.queue).toHaveLength(0);
  });

  it('does nothing if queue is empty', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: 4500,
    };

    const result = processQueue(state);

    expect(result).toEqual(state);
  });

  it('does not move if max messages limit reached', () => {
    const messages: MessageData[] = [
      { id: '1', type: 'information', message: 'Msg 1', timestamp: 1 },
      { id: '2', type: 'information', message: 'Msg 2', timestamp: 2 },
      { id: '3', type: 'information', message: 'Msg 3', timestamp: 3 },
      { id: '4', type: 'information', message: 'Msg 4', timestamp: 4 },
      { id: '5', type: 'information', message: 'Msg 5', timestamp: 5 },
    ];

    const state = {
      messages,
      queue: [{ id: '6', type: 'information', message: 'Queued', timestamp: 6 }],
      lastMessageTime: 4500,
    };

    const result = processQueue(state);

    expect(result.messages).toHaveLength(5);
    expect(result.queue).toHaveLength(1); // Queued message stays
  });

  it('updates lastMessageTime when a queued message is promoted to visible', () => {
    // processQueue must update lastMessageTime so subsequent addMessage
    // calls use the correct throttle baseline. Without this fix any message
    // added after processQueue runs can bypass the 500ms interval.
    const now = 5000;
    const state = {
      messages: [],
      queue: [{ id: '1', type: 'information', message: 'Queued', timestamp: now }],
      lastMessageTime: null,
    };

    const result = processQueue(state);

    expect(result.messages).toHaveLength(1);
    expect(result.lastMessageTime).not.toBeNull();
    // lastMessageTime must be at least as recent as the processing call
    expect(result.lastMessageTime).toBeGreaterThanOrEqual(now);
  });
});

describe('message-queue - FIFO queue behavior (T073)', () => {
  it('maintains messages in order of addition (oldest first)', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: null,
    };

    // Add messages with sufficient time between them to avoid throttling
    const msg1 = { id: '1', type: 'information', message: 'First', timestamp: 1000 };
    const msg2 = { id: '2', type: 'warning', message: 'Second', timestamp: 2000 };
    const msg3 = { id: '3', type: 'error', message: 'Third', timestamp: 3000 };

    const result1 = addMessage(state.messages, state.queue, state.lastMessageTime, msg1);
    const result2 = addMessage(result1.messages, result1.queue, result1.lastMessageTime + 500, msg2);
    const result3 = addMessage(result2.messages, result2.queue, result2.lastMessageTime + 500, msg3);

    expect(result3.messages).toHaveLength(3);
    expect(result3.messages[0].id).toBe('1');
    expect(result3.messages[1].id).toBe('2');
    expect(result3.messages[2].id).toBe('3');
  });

  it('processes pending queue in FIFO order', () => {
    const state = {
      messages: [],
      queue: [
        { id: '1', type: 'information', message: 'First queued', timestamp: 1000 },
        { id: '2', type: 'warning', message: 'Second queued', timestamp: 2000 },
      ],
      lastMessageTime: 500,
    };

    const result1 = processQueue(state);
    const result2 = processQueue({ ...result1, lastMessageTime: 1000 });

    expect(result1.messages).toHaveLength(1);
    expect(result1.messages[0].id).toBe('1');
    expect(result1.queue).toHaveLength(1);

    expect(result2.messages).toHaveLength(2);
    expect(result2.messages[0].id).toBe('1');
    expect(result2.messages[1].id).toBe('2');
    expect(result2.queue).toHaveLength(0);
  });
});

describe('message-queue - max messages limit enforcement (T074)', () => {
  it('enforces max 5 messages limit', () => {
    const state = {
      messages: [
        { id: '1', type: 'information', message: 'Msg 1', timestamp: 1 },
        { id: '2', type: 'information', message: 'Msg 2', timestamp: 2 },
        { id: '3', type: 'information', message: 'Msg 3', timestamp: 3 },
        { id: '4', type: 'information', message: 'Msg 4', timestamp: 4 },
        { id: '5', type: 'information', message: 'Msg 5', timestamp: 5 },
      ],
      queue: [],
      lastMessageTime: 5000,
    };

    const newMessage = { id: '6', type: 'information', message: 'New', timestamp: 6000 };
    const result = addMessage(state.messages, state.queue, state.lastMessageTime, newMessage);

    expect(result.messages).toHaveLength(5);
    expect(result.messages).not.toContainEqual(state.messages[0]);
    expect(result.messages).toContainEqual(state.messages[1]);
    expect(result.messages).toContainEqual(newMessage);
  });

  it('removes oldest when at max capacity', () => {
    const messages: MessageData[] = [
      { id: '1', type: 'information', message: 'Oldest', timestamp: 1 },
      { id: '2', type: 'information', message: 'Msg 2', timestamp: 2 },
      { id: '3', type: 'information', message: 'Msg 3', timestamp: 3 },
      { id: '4', type: 'information', message: 'Msg 4', timestamp: 4 },
      { id: '5', type: 'information', message: 'Msg 5', timestamp: 5 },
    ];

    const result = addMessage(messages, [], 5000, { id: '6', type: 'information', message: 'Newest', timestamp: 6000 });

    expect(result.messages[0].id).toBe('2'); // Oldest (id='1') removed
    expect(result.messages[4].id).toBe('6'); // Newest added
  });
});

describe('message-queue - pending queue processing (T075)', () => {
  it('adds to queue when throttle interval not met', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: 4500,
    };

    const newMessage = { id: '1', type: 'information', message: 'Test', timestamp: 4950 };
    const result = addMessage(state.messages, state.queue, state.lastMessageTime, newMessage);

    expect(result.queue).toHaveLength(1);
    expect(result.queue[0]).toEqual(newMessage);
    expect(result.messages).toHaveLength(0);
  });

  it('maintains queue order for multiple throttled messages', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: 4500,
    };

    const msg1 = { id: '1', type: 'information', message: 'First', timestamp: 4950 };
    const msg2 = { id: '2', type: 'warning', message: 'Second', timestamp: 4999 };

    const result1 = addMessage(state.messages, state.queue, state.lastMessageTime, msg1);
    const result2 = addMessage(result1.messages, result1.queue, result1.lastMessageTime, msg2);

    expect(result2.queue).toHaveLength(2);
    expect(result2.queue[0].id).toBe('1');
    expect(result2.queue[1].id).toBe('2');
  });
});

describe('message-queue - queue throttling with min interval (T076)', () => {
  it('respects 500ms minimum interval between messages', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: 4500,
    };

    const newMessage = { id: '1', type: 'information', message: 'Test', timestamp: 4999 };
    const result = addMessage(state.messages, state.queue, state.lastMessageTime, newMessage);

    // Should be queued because interval is 499ms (4999 - 4500 = 499) < 500ms
    expect(result.queue).toHaveLength(1);
    expect(result.messages).toHaveLength(0);
  });

  it('adds message directly when throttle interval met', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: 4000,
    };

    const newMessage = { id: '1', type: 'information', message: 'Test', timestamp: 5000 };
    const result = addMessage(state.messages, state.queue, state.lastMessageTime, newMessage);

    // Should be added directly because interval is 1000ms (> 500ms)
    expect(result.messages).toHaveLength(1);
    expect(result.queue).toHaveLength(0);
  });

  it('adds message directly when lastMessageTime is null', () => {
    const state = {
      messages: [],
      queue: [],
      lastMessageTime: null,
    };

    const newMessage = { id: '1', type: 'information', message: 'Test', timestamp: 5000 };
    const result = addMessage(state.messages, state.queue, state.lastMessageTime, newMessage);

    expect(result.messages).toHaveLength(1);
    expect(result.queue).toHaveLength(0);
  });
});
