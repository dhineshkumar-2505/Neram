import * as React from 'react';
void React;
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../../src/features/auth/screens/LoginScreen';
import * as googleAuthService from '../../src/services/auth/googleAuth';

// Mock dependencies
jest.mock('../../src/services/auth/googleAuth', () => ({
  signInWithGoogle: jest.fn(),
}));

jest.mock('../../src/features/auth/components/GoogleIcon', () => ({
  GoogleIcon: () => null,
}));

jest.mock('../../src/features/auth/components/TimeGlyph', () => ({
  TimeGlyph: () => null,
}));

describe('LoginScreen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders brand identity, core principles, and google sign-in button', () => {
    const { getByText, getByRole } = render(<LoginScreen />);

    expect(getByText('Nēram')).toBeTruthy();
    expect(getByText('Ephemeral circles. Real moments.')).toBeTruthy();
    expect(getByText('Finite Presence')).toBeTruthy();
    expect(getByText('Live On-Demand GPS')).toBeTruthy();
    expect(getByText('Zero Retention')).toBeTruthy();
    expect(getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  });

  it('triggers signInWithGoogle and invokes onSuccess callback upon success', async () => {
    const onSuccessMock = jest.fn();
    (googleAuthService.signInWithGoogle as jest.Mock).mockResolvedValueOnce({
      success: true,
      session: { access_token: 'valid_token' },
    });

    const { getByRole } = render(<LoginScreen onSuccess={onSuccessMock} />);
    const button = getByRole('button', { name: 'Continue with Google' });

    fireEvent.press(button);

    await waitFor(() => {
      expect(googleAuthService.signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });
  });

  it('displays error banner if signInWithGoogle fails', async () => {
    (googleAuthService.signInWithGoogle as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Google Sign-In failed due to network timeout.',
    });

    const { getByRole, getByText } = render(<LoginScreen />);
    const button = getByRole('button', { name: 'Continue with Google' });

    fireEvent.press(button);

    await waitFor(() => {
      expect(getByText('Google Sign-In failed due to network timeout.')).toBeTruthy();
    });

    // Dismiss error banner
    const dismissButton = getByRole('button', { name: 'Dismiss error' });
    fireEvent.press(dismissButton);

    await waitFor(() => {
      expect(() => getByText('Google Sign-In failed due to network timeout.')).toThrow();
    });
  });

  it('does not display an error banner if user cancels authentication', async () => {
    (googleAuthService.signInWithGoogle as jest.Mock).mockResolvedValueOnce({
      success: false,
      cancelled: true,
    });

    const { getByRole, queryByRole } = render(<LoginScreen />);
    const button = getByRole('button', { name: 'Continue with Google' });

    fireEvent.press(button);

    await waitFor(() => {
      expect(googleAuthService.signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(queryByRole('alert')).toBeNull();
    });
  });
});
