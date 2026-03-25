import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { MessageQueueProvider } from '@/components/MessageQueue';

describe('useMessageQueue - addMessage', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MessageQueueProvider>{children}</MessageQueueProvider>
  );

  it('should add information message', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });

    act(() => {
      result.current.addMessage('information', 'Test info');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('information');
    expect(result.current.messages[0].message).toBe('Test info');
  });

  it('should add warning message', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });

    act(() => {
      result.current.addMessage('warning', 'Test warning');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('warning');
    expect(result.current.messages[0].message).toBe('Test warning');
  });

  it('should add error message', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });

    act(() => {
      result.current.addMessage('error', 'Test error');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('error');
    expect(result.current.messages[0].message).toBe('Test error');
  });

  it('should reject invalid message type', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      result.current.addMessage('invalid' as any, 'Test');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid message type')
    );

    consoleSpy.mockRestore();
  });

  it('should reject empty message text', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      result.current.addMessage('information', '');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Message text cannot be empty'
    );

    consoleSpy.mockRestore();
  });
});

describe('useMessageQueue - dismissMessage', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MessageQueueProvider>{children}</MessageQueueProvider>
  );

  it('should dismiss message by id', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });

    act(() => {
      result.current.addMessage('information', 'Test');
    });

    const messageId = result.current.messages[0].id;

    act(() => {
      result.current.dismissMessage(messageId);
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('should do nothing if message id not found', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      result.current.addMessage('information', 'Test');
      result.current.dismissMessage('non-existent-id');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid'));
    consoleSpy.mockRestore();
  });
});

describe('useMessageQueue - closeAllMessages', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MessageQueueProvider>{children}</MessageQueueProvider>
  );

  it('should clear all messages', () => {
    const { result } = renderHook(() => useMessageQueue(), { wrapper });

    act(() => {
      result.current.addMessage('information', 'Message 1');
      result.current.addMessage('warning', 'Message 2');
      result.current.addMessage('error', 'Message 3');
    });

    // Due to throttling (500ms min interval), subsequent messages are queued.
    // At least the first message should be immediately visible.
    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.closeAllMessages();
    });

    expect(result.current.messages).toHaveLength(0);
  });
});

describe('useMessageQueue - context provider requirement', () => {
  it('should throw error when used outside MessageQueueProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useMessageQueue());
    }).toThrow('useMessageQueue must be used within a MessageQueueProvider');

    consoleSpy.mockRestore();
  });
});
