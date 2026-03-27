import {
  AUTO_DISMISS_DURATION,
  DISPLAY_CONSTRAINTS,
  MessageType,
  MessageData,
  isValidMessageType,
  isValidMessage,
} from '@/components/types';

describe('message-queue utilities', () => {
  let messageIdCounter = 0;

  const messageData = (type: MessageType, message: string): MessageData => {
    messageIdCounter++;
    return {
      id: `msg-${messageIdCounter}`,
      type,
      message,
      timestamp: Date.now(),
    };
  };

  describe('AUTO_DISMISS_DURATION', () => {
    it('returns 6000ms for information', () => {
      expect(AUTO_DISMISS_DURATION.information).toBe(6000);
    });

    it('returns 6000ms for warning', () => {
      expect(AUTO_DISMISS_DURATION.warning).toBe(6000);
    });

    it('returns null for error (no auto-dismiss)', () => {
      expect(AUTO_DISMISS_DURATION.error).toBe(null);
    });
  });

  describe('DISPLAY_CONSTRAINTS', () => {
    it('max messages is 5', () => {
      expect(DISPLAY_CONSTRAINTS.maxMessages).toBe(5);
    });

    it('min interval is 500ms', () => {
      expect(DISPLAY_CONSTRAINTS.minIntervalMs).toBe(500);
    });

    it('display position is top-center', () => {
      expect(DISPLAY_CONSTRAINTS.displayPosition).toEqual({
        vertical: 'top',
        horizontal: 'center',
      });
    });
  });

  describe('messageData factory', () => {
    it('creates message with unique id', () => {
      const msg1 = messageData('information', 'Test 1');
      const msg2 = messageData('warning', 'Test 2');

      expect(msg1.id).not.toBe(msg2.id);
    });

    it('sets current timestamp', () => {
      jest.useFakeTimers();
      const fixedTime = 1_700_000_000_000;
      jest.setSystemTime(fixedTime);

      const msg = messageData('information', 'Test');

      expect(msg.timestamp).toBeGreaterThanOrEqual(fixedTime);

      jest.useRealTimers();
    });
  });
});

describe('isValidMessageType', () => {
  it('returns true for "information"', () => {
    expect(isValidMessageType('information')).toBe(true);
  });

  it('returns true for "warning"', () => {
    expect(isValidMessageType('warning')).toBe(true);
  });

  it('returns true for "error"', () => {
    expect(isValidMessageType('error')).toBe(true);
  });

  it('returns false for "success"', () => {
    expect(isValidMessageType('success')).toBe(false);
  });

  it('returns false for "info"', () => {
    expect(isValidMessageType('info')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidMessageType('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidMessageType(null as unknown as string)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidMessageType(undefined as unknown as string)).toBe(false);
  });
});

describe('isValidMessage', () => {
  const validMessage: MessageData = {
    id: 'msg-1',
    type: 'information',
    message: 'Hello',
    timestamp: Date.now(),
  };

  it('returns true for valid MessageData object', () => {
    expect(isValidMessage(validMessage)).toBe(true);
  });

  it('returns false when id is empty string', () => {
    expect(isValidMessage({ ...validMessage, id: '' })).toBe(false);
  });

  it('returns false when type is invalid', () => {
    expect(isValidMessage({ ...validMessage, type: 'success' as MessageType })).toBe(false);
  });

  it('returns false when message is empty string', () => {
    expect(isValidMessage({ ...validMessage, message: '' })).toBe(false);
  });

  it('returns false when timestamp is 0', () => {
    expect(isValidMessage({ ...validMessage, timestamp: 0 })).toBe(false);
  });

  it('returns false when timestamp is negative', () => {
    expect(isValidMessage({ ...validMessage, timestamp: -1 })).toBe(false);
  });

  it('returns false when timestamp is missing', () => {
    const msg = { ...validMessage } as Record<string, unknown>;
    delete msg.timestamp;
    expect(isValidMessage(msg)).toBe(false);
  });

  it('returns false when id is missing', () => {
    const msg = { ...validMessage } as Record<string, unknown>;
    delete msg.id;
    expect(isValidMessage(msg)).toBe(false);
  });

  it('returns false when given null', () => {
    expect(isValidMessage(null)).toBe(false);
  });

  it('returns false when given undefined', () => {
    expect(isValidMessage(undefined)).toBe(false);
  });
});
