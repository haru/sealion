import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessageSnackbar from '@/components/MessageSnackbar';
import { AUTO_DISMISS_DURATION } from '@/components/types';

jest.useFakeTimers();

describe('MessageSnackbar - auto-dismiss timeout management (T064)', () => {
  it('INFO message auto-dismisses after 6000ms', () => {
    const mockOnClose = jest.fn();
    const message = {
      id: '1',
      type: 'information' as const,
      message: 'Test info message',
      timestamp: Date.now(),
    };

    render(<MessageSnackbar message={message} onClose={mockOnClose} />);

    // Initially, the close handler should not have been called
    expect(mockOnClose).not.toHaveBeenCalled();

    // Fast-forward time by 5999ms
    jest.advanceTimersByTime(5999);

    // Still should not have been called
    expect(mockOnClose).not.toHaveBeenCalled();

    // Fast-forward by 1 more ms (total 6000ms)
    jest.advanceTimersByTime(1);

    // Now should have been called
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledWith('1');
  });

  it('WARNING message auto-dismisses after 6000ms', () => {
    const mockOnClose = jest.fn();
    const message = {
      id: '2',
      type: 'warning' as const,
      message: 'Test warning message',
      timestamp: Date.now(),
    };

    render(<MessageSnackbar message={message} onClose={mockOnClose} />);

    jest.advanceTimersByTime(5999);
    expect(mockOnClose).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledWith('2');
  });

  it('ERROR message does not auto-dismiss', () => {
    const mockOnClose = jest.fn();
    const message = {
      id: '3',
      type: 'error' as const,
      message: 'Test error message',
      timestamp: Date.now(),
    };

    render(<MessageSnackbar message={message} onClose={mockOnClose} />);

    // Fast-forward well past the 6000ms timeout
    jest.advanceTimersByTime(10000);

    // Should not have been called (ERROR messages persist until manual close)
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('uses correct AUTO_DISMISS_DURATION constant for each type', () => {
    expect(AUTO_DISMISS_DURATION.information).toBe(6000);
    expect(AUTO_DISMISS_DURATION.warning).toBe(6000);
    expect(AUTO_DISMISS_DURATION.error).toBeNull();
  });
});

describe('MessageSnackbar - timeout cleanup on manual dismiss (T065)', () => {
  it('manual dismiss cancels auto-dismiss timeout', () => {
    const mockOnClose = jest.fn();
    const message = {
      id: '4',
      type: 'information' as const,
      message: 'Test message',
      timestamp: Date.now(),
    };

    render(<MessageSnackbar message={message} onClose={mockOnClose} />);

    // Trigger manual dismiss by clicking close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Should have been called immediately
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledWith('4');

    // Now advance timers past the auto-dismiss timeout
    jest.advanceTimersByTime(6000);

    // Should still have only been called once (manual close, not auto-dismiss)
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('manual dismiss works for ERROR message type', () => {
    const mockOnClose = jest.fn();
    const message = {
      id: '5',
      type: 'error' as const,
      message: 'Test error',
      timestamp: Date.now(),
    };

    render(<MessageSnackbar message={message} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledWith('5');
  });

  it('does not call onClose multiple times after manual dismiss', () => {
    const mockOnClose = jest.fn();
    const message = {
      id: '6',
      type: 'information' as const,
      message: 'Test message',
      timestamp: Date.now(),
    };

    render(<MessageSnackbar message={message} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Try clicking the button again (it should no longer be in the DOM)
    // But even if it were, it shouldn't cause issues

    // Advance timers significantly
    jest.advanceTimersByTime(20000);

    // Should still only have been called once
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
