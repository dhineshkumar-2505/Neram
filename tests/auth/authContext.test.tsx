import { render, renderHook, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, checkNeedsOnboarding } from '../../src/contexts/AuthContext';
import { useAuth } from '../../src/hooks/useAuth';
import type { Profile } from '../../src/types/auth';

describe('checkNeedsOnboarding helper', () => {
  it('returns true when profile is null', () => {
    expect(checkNeedsOnboarding(null)).toBe(true);
  });

  it('returns true when username starts with default auto-generated prefix user_', () => {
    const defaultProfile: Profile = {
      user_id: 'test-uuid-1',
      username: 'user_a1b2c3d4',
      display_name: 'Dhinesh Kumar',
      avatar_path: null,
      bio: null,
      dob: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(checkNeedsOnboarding(defaultProfile)).toBe(true);
  });

  it('returns true when display name is Anonymous User or empty', () => {
    const anonymousProfile: Profile = {
      user_id: 'test-uuid-2',
      username: 'custom_username',
      display_name: 'Anonymous User',
      avatar_path: null,
      bio: null,
      dob: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(checkNeedsOnboarding(anonymousProfile)).toBe(true);

    const emptyNameProfile: Profile = {
      ...anonymousProfile,
      display_name: '   ',
    };
    expect(checkNeedsOnboarding(emptyNameProfile)).toBe(true);
  });

  it('returns false when profile has custom username and valid display name', () => {
    const validProfile: Profile = {
      user_id: 'test-uuid-3',
      username: 'dhinesh',
      display_name: 'Dhinesh Kumar',
      avatar_path: 'avatars/avatar.png',
      bio: 'Software engineer building Neram.',
      dob: '2000-01-01',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(checkNeedsOnboarding(validProfile)).toBe(false);
  });
});

describe('useAuth Hook', () => {
  it('throws an error when consumed outside of AuthProvider', () => {
    // Suppress console.error in test output for expected error boundary test
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an <AuthProvider>');

    consoleError.mockRestore();
  });

  it('provides unauthenticated state by default on fresh mount', async () => {
    function TestConsumer() {
      const { status, session, user } = useAuth();
      return (
        <Text testID="auth-status">
          {`${status}:${session === null ? 'no-session' : 'session'}:${user === null ? 'no-user' : 'user'}`}
        </Text>
      );
    }

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('auth-status').props.children).toBe('UNAUTHENTICATED:no-session:no-user');
    });
  });
});
