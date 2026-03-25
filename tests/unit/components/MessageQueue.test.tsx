import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageQueueProvider, useMessageQueue } from '@/components/MessageQueue';

describe('MessageQueue component - concurrent message rendering (T077)', () => {
  it('renders multiple messages simultaneously', () => {
    const TestComponent = () => {
      const { addMessage } = useMessageQueue();

      return (
        <div>
          <button onClick={() => addMessage('information', 'Info 1')}>Add 1</button>
          <button onClick={() => addMessage('warning', 'Warning 1')}>Add 2</button>
          <button onClick={() => addMessage('error', 'Error 1')}>Add 3</button>
        </div>
      );
    };

    render(
      <MessageQueueProvider>
        <TestComponent />
      </MessageQueueProvider>
    );

    const button1 = screen.getByText('Add 1');
    const button2 = screen.getByText('Add 2');
    const button3 = screen.getByText('Add 3');

    // Add three messages with small delays to bypass throttling
    fireEvent.click(button1);
    waitFor(() => {
      expect(screen.getByText('Info 1')).toBeInTheDocument();
    }, { timeout: 100 });

    fireEvent.click(button2);
    waitFor(() => {
      expect(screen.getByText('Warning 1')).toBeInTheDocument();
    }, { timeout: 100 });

    fireEvent.click(button3);
    waitFor(() => {
      expect(screen.getByText('Error 1')).toBeInTheDocument();
    }, { timeout: 100 });
  });

  it('renders messages with different severity levels', () => {
    const TestComponent = () => {
      const { addMessage } = useMessageQueue();

      return (
        <div>
          <button onClick={() => addMessage('information', 'Info')}>Add Info</button>
          <button onClick={() => addMessage('warning', 'Warning')}>Add Warning</button>
          <button onClick={() => addMessage('error', 'Error')}>Add Error</button>
        </div>
      );
    };

    render(
      <MessageQueueProvider>
        <TestComponent />
      </MessageQueueProvider>
    );

    fireEvent.click(screen.getByText('Add Info'));
    fireEvent.click(screen.getByText('Add Warning'));
    fireEvent.click(screen.getByText('Add Error'));

    // Verify all three messages are rendered
    waitFor(() => {
      expect(screen.getByText('Info')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});

describe('MessageQueue component - message shift on dismiss (T078)', () => {
  it('removes correct message when dismissed', () => {
    const TestComponent = () => {
      const { addMessage, messages, dismissMessage } = useMessageQueue();

      return (
        <div>
          <button onClick={() => addMessage('information', 'Message 1')}>Add 1</button>
          <button onClick={() => addMessage('information', 'Message 2')}>Add 2</button>
          <div>
            {messages.map(msg => (
              <button key={msg.id} onClick={() => dismissMessage(msg.id)}>
                Dismiss {msg.message}
              </button>
            ))}
          </div>
        </div>
      );
    };

    render(
      <MessageQueueProvider>
        <TestComponent />
      </MessageQueueProvider>
    );

    fireEvent.click(screen.getByText('Add 1'));
    fireEvent.click(screen.getByText('Add 2'));

    waitFor(() => {
      expect(screen.getByText('Dismiss Message 1')).toBeInTheDocument();
      expect(screen.getByText('Dismiss Message 2')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Dismiss the first message
    fireEvent.click(screen.getByText('Dismiss Message 1'));

    // Only second message should remain
    waitFor(() => {
      expect(screen.queryByText('Dismiss Message 1')).not.toBeInTheDocument();
      expect(screen.getByText('Dismiss Message 2')).toBeInTheDocument();
    }, { timeout: 100 });
  });

  it('maintains order of remaining messages after dismissal', () => {
    const TestComponent = () => {
      const { addMessage, dismissMessage, messages } = useMessageQueue();

      return (
        <div>
          <button onClick={() => addMessage('information', 'Msg 1')}>Add 1</button>
          <button onClick={() => addMessage('information', 'Msg 2')}>Add 2</button>
          <button onClick={() => addMessage('information', 'Msg 3')}>Add 3</button>
          <button onClick={() => addMessage('information', 'Msg 4')}>Add 4</button>
          <div>
            {messages.map((msg, index) => (
              <div key={msg.id} data-testid={`msg-${index}`}>
                {msg.message}
              </div>
            ))}
          </div>
          <button onClick={() => dismissMessage(messages[1]?.id || '')}>Dismiss Second</button>
        </div>
      );
    };

    render(
      <MessageQueueProvider>
        <TestComponent />
      </MessageQueueProvider>
    );

    const button1 = screen.getByText('Add 1');
    const button2 = screen.getByText('Add 2');
    const button3 = screen.getByText('Add 3');
    const button4 = screen.getByText('Add 4');

    fireEvent.click(button1);
    fireEvent.click(button2);
    fireEvent.click(button3);
    fireEvent.click(button4);

    waitFor(() => {
      expect(screen.getByTestId('msg-0')).toHaveTextContent('Msg 1');
      expect(screen.getByTestId('msg-1')).toHaveTextContent('Msg 2');
      expect(screen.getByTestId('msg-2')).toHaveTextContent('Msg 3');
      expect(screen.getByTestId('msg-3')).toHaveTextContent('Msg 4');
    }, { timeout: 1000 });

    // Dismiss the second message (Msg 2)
    fireEvent.click(screen.getByText('Dismiss Second'));

    waitFor(() => {
      // Messages should shift, maintaining order
      expect(screen.getByTestId('msg-0')).toHaveTextContent('Msg 1');
      expect(screen.getByTestId('msg-1')).toHaveTextContent('Msg 3');
      expect(screen.getByTestId('msg-2')).toHaveTextContent('Msg 4');
      expect(screen.queryByTestId('msg-3')).not.toBeInTheDocument();
    }, { timeout: 100 });
  });
});
