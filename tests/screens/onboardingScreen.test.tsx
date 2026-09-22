import * as React from 'react';
void React;
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { OnboardingScreen } from '../../src/features/auth/screens/OnboardingScreen';
import * as authHook from '../../src/hooks/useAuth';
import * as usernameService from '../../src/features/profile/services/usernameService';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/profile/services/usernameService');

describe('OnboardingScreen Component', () => {
  const mockUpdateProfile = jest.fn();
  const mockUser = { id: 'user_test_uuid', email: 'test@example.com' };
  const mockProfile = {
    user_id: 'user_test_uuid',
    username: 'user_a1b2c3d4',
    display_name: 'Anonymous User',
    avatar_url: null,
    status_message: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      updateProfile: mockUpdateProfile,
    });

    (usernameService.validateUsernameSyntax as jest.Mock).mockImplementation((username: string) => {
      if (username.length < 3) return { isValid: false, error: 'Too short' };
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return { isValid: false, error: 'Invalid characters' };
      return { isValid: true };
    });

    (usernameService.checkUsernameAvailability as jest.Mock).mockResolvedValue({
      available: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders initial setup inputs and avatar themes', () => {
    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    expect(getByText('Craft Your Identity')).toBeTruthy();
    expect(getByLabelText('Display Name')).toBeTruthy();
    expect(getByLabelText('Unique Handle')).toBeTruthy();
    expect(getByLabelText('Select Indigo Night theme')).toBeTruthy();
  });

  it('checks username availability when user enters a handle and updates status', async () => {
    jest.useFakeTimers();

    const { getByLabelText, getByText } = render(<OnboardingScreen />);
    const usernameInput = getByLabelText('Unique Handle');

    fireEvent.changeText(usernameInput, 'alex_chen');

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(getByText('@alex_chen is available')).toBeTruthy();
    expect(usernameService.checkUsernameAvailability).toHaveBeenCalledWith('alex_chen', 'user_test_uuid');
  });

  it('submits updated profile when form is valid and button is pressed', async () => {
    jest.useFakeTimers();
    const onSuccessMock = jest.fn();

    mockUpdateProfile.mockResolvedValueOnce({
      ...mockProfile,
      display_name: 'Maya Lin',
      username: 'mayalin',
    });

    const { getByLabelText, getByRole } = render(<OnboardingScreen onSuccess={onSuccessMock} />);

    const displayNameInput = getByLabelText('Display Name');
    const usernameInput = getByLabelText('Unique Handle');

    fireEvent.changeText(displayNameInput, 'Maya Lin');
    fireEvent.changeText(usernameInput, 'mayalin');

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    const submitBtn = getByRole('button', { name: 'Complete & Enter Nēram' });
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Maya Lin',
          username: 'mayalin',
        }),
      );
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });
  });

  it('displays error banner if updateProfile fails', async () => {
    jest.useFakeTimers();
    mockUpdateProfile.mockResolvedValueOnce(null);

    const { getByLabelText, getByRole, getByText } = render(<OnboardingScreen />);

    fireEvent.changeText(getByLabelText('Display Name'), 'Maya Lin');
    fireEvent.changeText(getByLabelText('Unique Handle'), 'mayalin');

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    const submitBtn = getByRole('button', { name: 'Complete & Enter Nēram' });
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    expect(getByText('Failed to save profile. Please check connection and try again.')).toBeTruthy();
  });
});
