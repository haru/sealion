import { AUTO_DISMISS_DURATION, DISPLAY_CONSTRAINTS, MessageType, MessageData } from '@/components/types';

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
      const beforeTime = Date.now();
      jest.useFakeTimers();
      const msg = messageData('information', 'Test');

      expect(msg.timestamp).toBeGreaterThanOrEqual(beforeTime);

      jest.useRealTimers();
    });
  });
});
