import * as React from 'react';
void React;
import { render, fireEvent, act } from '@testing-library/react-native';
import { GroupDetailScreen } from '../../src/navigation/screens/GroupDetailScreen';
import { groupService } from '../../src/features/groups/services/groupService';
import * as authHook from '../../src/hooks/useAuth';
import type { RootStackScreenProps } from '../../src/navigation/types';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
}));

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/groups/services/groupService');
jest.mock('../../src/features/groups/services/lifecycleService', () => ({
  lifecycleService: {
    subscribeToGroupLifecycle: jest.fn().mockReturnValue(() => {}),
    triggerLifecycleSync: jest.fn().mockResolvedValue({ metrics: null }),
  },
}));

describe('GroupDetailScreen Component', () => {
  const mockRoute = {
    key: 'GroupDetail-test',
    name: 'GroupDetail',
    params: {
      groupId: 'grp_test_123',
      groupName: 'Summit Trail Hike',
    },
  } as unknown as RootStackScreenProps<'GroupDetail'>['route'];

  const mockNavigation = {
    goBack: mockGoBack,
    navigate: mockNavigate,
  } as unknown as RootStackScreenProps<'GroupDetail'>['navigation'];

  const mockGroup = {
    id: 'grp_test_123',
    owner_id: 'user_owner_id',
    name: 'Summit Trail Hike',
    description: 'Trailhead meetup at 6 AM',
    image_path: null,
    purpose: 'OUTING' as const,
    starts_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
    lifecycle_state: 'ACTIVE' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    members: [
      {
        user_id: 'user_owner_id',
        role: 'OWNER' as const,
        joined_at: new Date().toISOString(),
        profile: {
          user_id: 'user_owner_id',
          username: 'trailboss',
          display_name: 'Trail Boss',
          avatar_path: null,
        },
      },
      {
        user_id: 'user_member_id',
        role: 'MEMBER' as const,
        joined_at: new Date().toISOString(),
        profile: {
          user_id: 'user_member_id',
          username: 'hikerjane',
          display_name: 'Jane Hiker',
          avatar_path: null,
        },
      },
    ],
    features: [
      { feature_key: 'CHAT', enabled_at: new Date().toISOString() },
      { feature_key: 'TASKS', enabled_at: new Date().toISOString() },
      { feature_key: 'LOCATION', enabled_at: new Date().toISOString() },
    ],
    currentUserRole: 'OWNER' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user_owner_id' },
    });
  });

  it('renders loading state initially then renders group interior', async () => {
    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValueOnce({
      group: mockGroup,
    });

    const { getByTestId, getByText, getAllByText, findByText } = render(
      <GroupDetailScreen route={mockRoute} navigation={mockNavigation} />,
    );

    // Initial loading indicator
    expect(getByTestId('skeleton-group-detail')).toBeTruthy();

    // Settle into group interior
    const title = await findByText('Summit Trail Hike');
    expect(title).toBeTruthy();
    expect(getByText('TEMPORARY SPACE • OUTING')).toBeTruthy();
    expect(getByText('Trailhead meetup at 6 AM')).toBeTruthy();

    // Hero Countdown Card checks
    const heroCard = await findByText(/OUTING • LIVE MAP & ETA/i);
    expect(heroCard).toBeTruthy();
    expect(getAllByText('ACTIVE').length).toBeGreaterThanOrEqual(1);

    // Member Roster checks
    expect(getByText('MEMBERS (2)')).toBeTruthy();
    expect(getByText('Trail Boss')).toBeTruthy();
    expect(getByText('Jane Hiker')).toBeTruthy();

    // Module Hub checks
    expect(getByText('Ephemeral Chat')).toBeTruthy();
    expect(getByText('Live Map & ETA')).toBeTruthy();
  });

  it('renders error state when space fetch fails and allows retry', async () => {
    (groupService.fetchGroupDetails as jest.Mock)
      .mockResolvedValueOnce({
        group: null,
        error: 'Space does not exist or has been purged.',
      })
      .mockResolvedValueOnce({
        group: mockGroup,
      });

    const { getByText, findByText } = render(
      <GroupDetailScreen route={mockRoute} navigation={mockNavigation} />,
    );

    const errorMessage = await findByText('Space does not exist or has been purged.');
    expect(errorMessage).toBeTruthy();

    const retryBtn = getByText('Retry Connection');
    await act(async () => {
      fireEvent.press(retryBtn);
    });

    const recoveredTitle = await findByText('Summit Trail Hike');
    expect(recoveredTitle).toBeTruthy();
  });

  it('navigates back to Command Center when Return button is pressed', async () => {
    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValueOnce({
      group: mockGroup,
    });

    const { findByText } = render(
      <GroupDetailScreen route={mockRoute} navigation={mockNavigation} />,
    );

    const returnBtn = await findByText('Return to Command Center');
    fireEvent.press(returnBtn);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders expired space status when group has expired', async () => {
    const expiredGroup = {
      ...mockGroup,
      lifecycle_state: 'EXPIRED' as const,
      expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    };

    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValueOnce({
      group: expiredGroup,
    });

    const { findByText } = render(
      <GroupDetailScreen route={mockRoute} navigation={mockNavigation} />,
    );

    const expiredStateBadge = await findByText('EXPIRED');
    expect(expiredStateBadge).toBeTruthy();
    expect(await findByText('Space Expired')).toBeTruthy();
  });
});
