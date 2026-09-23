import * as React from 'react';
void React;
import { render } from '@testing-library/react-native';
import { TypingIndicator } from '../../src/features/chat/components/TypingIndicator';

describe('TypingIndicator', () => {
  it('renders typing label and indicator dots when typingLabel is present', () => {
    const { getByText, getByTestId } = render(
      <TypingIndicator typingLabel="Alex is typing..." />,
    );

    expect(getByTestId('typing-indicator')).toBeTruthy();
    expect(getByText('Alex is typing...')).toBeTruthy();
  });

  it('renders multi-user typing label correctly', () => {
    const { getByText } = render(
      <TypingIndicator typingLabel="Alex, Priya, and 1 other are typing..." />,
    );

    expect(getByText('Alex, Priya, and 1 other are typing...')).toBeTruthy();
  });

  it('renders nothing when typingLabel is empty string', () => {
    const { queryByTestId } = render(
      <TypingIndicator typingLabel="" />,
    );

    expect(queryByTestId('typing-indicator')).toBeNull();
  });

  it('cleans up animations cleanly on unmount', () => {
    const { unmount } = render(
      <TypingIndicator typingLabel="Alex is typing..." />,
    );

    expect(() => unmount()).not.toThrow();
  });
});
