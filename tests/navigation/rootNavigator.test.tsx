import * as React from 'react';
void React;
import { render } from '@testing-library/react-native';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import * as authHook from '../../src/hooks/useAuth';

jest.mock('../../src/hooks/useAuth');

// Mock components cleanly using jest.requireActual
jest.mock('../../src/navigation/AuthNavigator', () => {
  const { Text } = jest.requireActual('react-native');
  const MockAuthNavigator = ({ initialRouteName }: { initialRouteName: string }) => (
    <Text>{`AuthNavigatorMock:${initialRouteName}`}</Text>
  );
  return {
    __esModule: true,
    default: MockAuthNavigator,
  };
});

jest.mock('../../src/navigation/MainTabNavigator', () => {
  const { Text } = jest.requireActual('react-native');
  const MockMainTabs = () => <Text>MainTabsScreenMock</Text>;
  return {
    __esModule: true,
    default: MockMainTabs,
  };
});

jest.mock('../../src/navigation/screens/GroupDetailScreen', () => {
  const { Text } = jest.requireActual('react-native');
  const MockGroupDetail = () => <Text>GroupDetailScreenMock</Text>;
  return {
    __esModule: true,
    default: MockGroupDetail,
  };
});

jest.mock('../../src/features/auth/screens/AuthLoadingScreen', () => {
  const { Text } = jest.requireActual('react-native');
  const MockAuthLoading = () => <Text>AuthLoadingScreenMock</Text>;
  return {
    __esModule: true,
    default: MockAuthLoading,
  };
});

describe('RootNavigator Auth Guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders AuthLoadingScreen when auth status is INITIALIZING', () => {
    (authHook.useAuth as jest.Mock).mockReturnValue({
      status: 'INITIALIZING',
      user: null,
      session: null,
      profile: null,
    });

    const { getByText, queryByText } = render(<RootNavigator />);

    expect(getByText('AuthLoadingScreenMock')).toBeTruthy();
    expect(queryByText('MainTabsScreenMock')).toBeNull();
    expect(queryByText(/AuthNavigatorMock/)).toBeNull();
  });

  it('renders AuthNavigator with Login route when status is UNAUTHENTICATED', () => {
    (authHook.useAuth as jest.Mock).mockReturnValue({
      status: 'UNAUTHENTICATED',
      user: null,
      session: null,
      profile: null,
    });

    const { getByText, queryByText } = render(<RootNavigator />);

    expect(getByText('AuthNavigatorMock:Login')).toBeTruthy();
    expect(queryByText('MainTabsScreenMock')).toBeNull();
  });

  it('renders AuthNavigator with Onboarding route when status is NEEDS_ONBOARDING', () => {
    (authHook.useAuth as jest.Mock).mockReturnValue({
      status: 'NEEDS_ONBOARDING',
      user: { id: 'test_uuid' },
      session: {},
      profile: { display_name: 'Anonymous User', username: 'user_12345678' },
    });

    const { getByText, queryByText } = render(<RootNavigator />);

    expect(getByText('AuthNavigatorMock:Onboarding')).toBeTruthy();
    expect(queryByText('MainTabsScreenMock')).toBeNull();
  });

  it('renders MainTabs when status is AUTHENTICATED', () => {
    (authHook.useAuth as jest.Mock).mockReturnValue({
      status: 'AUTHENTICATED',
      user: { id: 'test_uuid' },
      session: {},
      profile: { display_name: 'Maya Lin', username: 'mayalin' },
    });

    const { getByText, queryByText } = render(<RootNavigator />);

    expect(getByText('MainTabsScreenMock')).toBeTruthy();
    expect(queryByText(/AuthNavigatorMock/)).toBeNull();
  });
});
