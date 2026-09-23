import * as React from 'react';
void React;
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LocationSessionScreen } from '../../src/features/location/screens/LocationSessionScreen';
import * as authHook from '../../src/hooks/useAuth';
import * as locationHook from '../../src/features/location/hooks/useLocationSession';
import * as lifecycleHook from '../../src/features/groups/hooks/useGroupLifecycle';
import { groupService } from '../../src/features/groups/services/groupService';
import type { LocationSession, SessionParticipant } from '../../src/features/location/types';
import type { RootStackScreenProps } from '../../src/navigation/types';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/location/hooks/useLocationSession');
jest.mock('../../src/features/groups/hooks/useGroupLifecycle');
jest.mock('../../src/features/groups/services/groupService');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('LocationSessionScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
  } as unknown as RootStackScreenProps<'LocationSession'>['navigation'];

  const mockRoute = {
    key: 'LocationSession-key',
    name: 'LocationSession' as const,
    params: {
      groupId: 'grp_location_100',
      groupName: 'Weekend Hiking Group',
    },
  } as unknown as RootStackScreenProps<'LocationSession'>['route'];

  const mockActiveSession: LocationSession = {
    id: 'sess_active_1',
    groupId: 'grp_location_100',
    createdBy: 'usr_leader',
    title: 'Trailhead Meetup & Hike',
    destinationName: 'North Ridge Lookout',
    destinationLat: 37.7749,
    destinationLng: -122.4194,
    status: 'ACTIVE',
    startsAt: '2026-09-23T10:00:00Z',
    endsAt: '2026-09-23T14:00:00Z',
    endedAt: null,
    createdAt: '2026-09-23T09:30:00Z',
    updatedAt: '2026-09-23T09:30:00Z',
    creator: {
      userId: 'usr_leader',
      displayName: 'Hike Leader Dave',
      username: 'dave_hikes',
      avatarPath: null,
    },
  };

  const mockParticipants: SessionParticipant[] = [
    {
      id: 'part_1',
      sessionId: 'sess_active_1',
      userId: 'usr_leader',
      status: 'ACTIVE',
      joinedAt: '2026-09-23T09:30:00Z',
      leftAt: null,
      user: {
        userId: 'usr_leader',
        displayName: 'Hike Leader Dave',
        username: 'dave_hikes',
        avatarPath: null,
      },
    },
    {
      id: 'part_2',
      sessionId: 'sess_active_1',
      userId: 'usr_me',
      status: 'ACTIVE',
      joinedAt: '2026-09-23T09:35:00Z',
      leftAt: null,
      user: {
        userId: 'usr_me',
        displayName: 'Sam Adventurer',
        username: 'sam_adv',
        avatarPath: null,
      },
    },
  ];

  const mockRefresh = jest.fn();
  const mockStartSession = jest.fn();
  const mockJoinSession = jest.fn();
  const mockLeaveSession = jest.fn().mockResolvedValue({ success: true });
  const mockEndSession = jest.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    jest.clearAllMocks();

    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'usr_me', email: 'sam@test.com' },
      session: { user: { id: 'usr_me' } },
    });

    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: {
        id: 'grp_location_100',
        name: 'Weekend Hiking Group',
        owner_id: 'usr_leader',
        currentUserRole: 'MEMBER',
        starts_at: '2026-09-23T00:00:00Z',
        expires_at: '2026-09-25T00:00:00Z',
        lifecycle_state: 'ACTIVE',
      },
    });

    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      remainingTime: {
        formattedText: '1d 14h remaining',
      },
      isExpired: false,
    });

    (locationHook.useLocationSession as jest.Mock).mockReturnValue({
      activeSession: mockActiveSession,
      participants: mockParticipants,
      isLoading: false,
      isRefreshing: false,
      error: null,
      isParticipating: true,
      refresh: mockRefresh,
      startSession: mockStartSession,
      joinSession: mockJoinSession,
      leaveSession: mockLeaveSession,
      endSession: mockEndSession,
    });
  });

  it('renders header, space name, remaining lifespan badge, and active session details', async () => {
    const { getByText, findByText } = render(
      <LocationSessionScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Weekend Hiking Group')).toBeTruthy();
    expect(getByText('Live Outing & ETA')).toBeTruthy();
    expect(getByText('1d 14h remaining')).toBeTruthy();
    expect(getByText('Trailhead Meetup & Hike')).toBeTruthy();
    expect(getByText('North Ridge Lookout')).toBeTruthy();
    expect(getByText('Organized by @dave_hikes')).toBeTruthy();
  });

  it('renders active participant roster and sharing badge', async () => {
    const { getByText, findByText } = render(
      <LocationSessionScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Live Outing & ETA')).toBeTruthy();
    expect(getByText('PARTICIPATING MEMBERS (2)')).toBeTruthy();
    expect(getByText('Hike Leader Dave')).toBeTruthy();
    expect(getByText('Sam Adventurer (You)')).toBeTruthy();
    expect(getByText('You are sharing location in this outing')).toBeTruthy();
  });

  it('renders Leave Location Sharing button when user is participating', async () => {
    const { getByTestId, findByText } = render(
      <LocationSessionScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Live Outing & ETA')).toBeTruthy();
    expect(getByTestId('leave-sharing-button')).toBeTruthy();
  });

  it('renders Join Outing button when user has not yet opted in', async () => {
    (locationHook.useLocationSession as jest.Mock).mockReturnValue({
      activeSession: mockActiveSession,
      participants: [mockParticipants[0]],
      isLoading: false,
      isRefreshing: false,
      error: null,
      isParticipating: false,
      refresh: mockRefresh,
      startSession: mockStartSession,
      joinSession: mockJoinSession,
      leaveSession: mockLeaveSession,
      endSession: mockEndSession,
    });

    const { getByTestId, getByText, findByText } = render(
      <LocationSessionScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Live Outing & ETA')).toBeTruthy();
    expect(getByTestId('join-outing-button')).toBeTruthy();
    expect(getByText('Join Rendezvous Outing')).toBeTruthy();

    fireEvent.press(getByTestId('join-outing-button'));
    expect(getByText('Share Live Outing Location')).toBeTruthy();
  });

  it('renders empty state when no active session exists for group', async () => {
    (locationHook.useLocationSession as jest.Mock).mockReturnValue({
      activeSession: null,
      participants: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      isParticipating: false,
      refresh: mockRefresh,
      startSession: mockStartSession,
      joinSession: mockJoinSession,
      leaveSession: mockLeaveSession,
      endSession: mockEndSession,
    });

    const { getByText, findByText } = render(
      <LocationSessionScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Live Outing & ETA')).toBeTruthy();
    expect(getByText('No Active Outing Session')).toBeTruthy();
    expect(getByText('Start Outing Session')).toBeTruthy();
  });

  it('renders expired read-only banner when temporary space has expired', async () => {
    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      remainingTime: {
        formattedText: 'EXPIRED',
      },
      isExpired: true,
    });

    const { getByText, queryByTestId, findByText } = render(
      <LocationSessionScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText(/SPACE DISSOLVED/i)).toBeTruthy();
    expect(queryByTestId('leave-sharing-button')).toBeNull();
    expect(queryByTestId('join-outing-button')).toBeNull();
  });

  it('calls goBack when back button is pressed', async () => {
    const { getByTestId, findByText } = render(
      <LocationSessionScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Live Outing & ETA')).toBeTruthy();
    fireEvent.press(getByTestId('location-back-button'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
