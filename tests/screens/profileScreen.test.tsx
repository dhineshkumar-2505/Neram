import * as React from 'react';
void React;
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../../src/features/profile/screens/ProfileScreen';
import * as authHook from '../../src/hooks/useAuth';

jest.mock('../../src/hooks/useAuth');

jest.mock('../../src/features/auth/components/TimeGlyph', () => {
  return () => null;
});

describe('ProfileScreen Component', () => {
  const mockUpdateProfile = jest.fn();
  const mockSignOut = jest.fn();

  const mockProfile = {
    user_id: 'user_test_uuid_123',
    username: 'mayalin',
    display_name: 'Maya Lin',
    avatar_path: null,
    bio: 'Exploring coffee spots in Chennai',
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    dob: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      profile: mockProfile,
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
      isLoading: false,
    });
  });

  it('renders user identity, handle, bio, and sign-out button', () => {
    const { getByText, getByRole } = render(<ProfileScreen />);

    expect(getByText('Profile & Identity')).toBeTruthy();
    expect(getByText('Maya Lin')).toBeTruthy();
    expect(getByText('@mayalin')).toBeTruthy();
    expect(getByText('"Exploring coffee spots in Chennai"')).toBeTruthy();
    expect(getByText('Android KeyStore Secured')).toBeTruthy();
    expect(getByRole('button', { name: 'Edit Profile' })).toBeTruthy();
    expect(getByRole('button', { name: 'Sign Out of Nēram' })).toBeTruthy();
  });

  it('enters edit mode and allows updating display name and bio', async () => {
    mockUpdateProfile.mockResolvedValueOnce({
      ...mockProfile,
      display_name: 'Maya Lin Architect',
      bio: 'New bio message',
    });

    const { getByRole, getByLabelText, getByText } = render(<ProfileScreen />);

    const editBtn = getByRole('button', { name: 'Edit Profile' });
    fireEvent.press(editBtn);

    const nameInput = getByLabelText('Edit Display Name');
    const bioInput = getByLabelText('Edit Presence Note');

    fireEvent.changeText(nameInput, 'Maya Lin Architect');
    fireEvent.changeText(bioInput, 'New bio message');

    const saveBtn = getByRole('button', { name: 'Save profile changes' });
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        display_name: 'Maya Lin Architect',
        bio: 'New bio message',
      });
      expect(getByText('Profile updated successfully.')).toBeTruthy();
    });
  });

  it('validates display name and prevents empty save', async () => {
    const { getByRole, getByLabelText, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByRole('button', { name: 'Edit Profile' }));

    const nameInput = getByLabelText('Edit Display Name');
    fireEvent.changeText(nameInput, '   ');

    fireEvent.press(getByRole('button', { name: 'Save profile changes' }));

    await waitFor(() => {
      expect(getByText('Display name must be between 1 and 50 characters.')).toBeTruthy();
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });
  });

  it('cancels edit mode and restores original values', () => {
    const { getByRole, getByLabelText, queryByLabelText, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByRole('button', { name: 'Edit Profile' }));
    expect(getByLabelText('Edit Display Name')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Cancel editing' }));

    expect(queryByLabelText('Edit Display Name')).toBeNull();
    expect(getByText('Maya Lin')).toBeTruthy();
  });

  it('invokes signOut when sign out button is pressed', async () => {
    const { getByRole } = render(<ProfileScreen />);
    const signOutBtn = getByRole('button', { name: 'Sign Out of Nēram' });

    fireEvent.press(signOutBtn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });
});
