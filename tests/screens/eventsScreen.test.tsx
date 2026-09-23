import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { EventsScreen } from '../../src/features/events/screens/EventsScreen';
import * as authHook from '../../src/hooks/useAuth';
import * as eventsHook from '../../src/features/events/hooks/useEvents';
import * as lifecycleHook from '../../src/features/groups/hooks/useGroupLifecycle';
import { groupService } from '../../src/features/groups/services/groupService';
import type { EventRecord } from '../../src/features/events/types';
import type { RootStackScreenProps } from '../../src/navigation/types';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/events/hooks/useEvents');
jest.mock('../../src/features/groups/hooks/useGroupLifecycle');
jest.mock('../../src/features/groups/services/groupService');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('EventsScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
  } as unknown as RootStackScreenProps<'Events'>['navigation'];

  const mockRoute = {
    key: 'Events-key',
    name: 'Events' as const,
    params: {
      groupId: 'grp_events_123',
      groupName: 'AI Hackathon Space',
    },
  } as unknown as RootStackScreenProps<'Events'>['route'];

  const mockSampleEvent: EventRecord = {
    id: 'evt_hero_1',
    groupId: 'grp_events_123',
    creatorId: 'user_1',
    title: 'Prototype Pitch & Demo',
    description: 'Present working demo to judges',
    targetTime: '2026-09-28T16:00:00.000Z',
    endsAt: null,
    locationName: 'Stage 1',
    latitude: 1.3001,
    longitude: 103.8555,
    isMilestone: true,
    createdAt: '2026-09-23T10:00:00.000Z',
    creator: {
      userId: 'user_1',
      displayName: 'Alice Lead',
      username: 'alice',
      avatarUrl: null,
    },
  };

  const mockRefresh = jest.fn();
  const mockCreateEvent = jest.fn();
  const mockUpdateEvent = jest.fn();
  const mockDeleteEvent = jest.fn();
  const mockSetActiveFilter = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user_1', email: 'alice@test.com' },
      session: { user: { id: 'user_1' } },
    });

    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: {
        id: 'grp_events_123',
        name: 'AI Hackathon Space',
        starts_at: '2026-09-23T00:00:00Z',
        expires_at: '2026-09-30T00:00:00Z',
        lifecycle_state: 'ACTIVE',
      },
    });

    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      remainingTime: {
        days: 6,
        hours: 12,
        minutes: 0,
        seconds: 0,
        totalRemainingSeconds: 561600,
        isExpiring: false,
        isExpired: false,
        progressFraction: 0.1,
        formattedText: '6d 12h remaining',
      },
      lifecycleState: 'ACTIVE',
      isExpiring: false,
      isExpired: false,
    });

    (eventsHook.useEvents as jest.Mock).mockReturnValue({
      allEvents: [mockSampleEvent],
      filteredEvents: [mockSampleEvent],
      heroEvent: mockSampleEvent,
      activeFilter: 'ALL',
      setActiveFilter: mockSetActiveFilter,
      isLoading: false,
      isRefreshing: false,
      error: null,
      counts: {
        all: 1,
        upcoming: 1,
        milestones: 1,
        past: 0,
      },
      refresh: mockRefresh,
      createEvent: mockCreateEvent,
      updateEvent: mockUpdateEvent,
      deleteEvent: mockDeleteEvent,
    });
  });

  it('renders header, space name, remaining lifespan badge, and event card', () => {
    const { getByText, getAllByText, getByTestId } = render(
      <EventsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Shared Itinerary')).toBeTruthy();
    expect(getByText('AI Hackathon Space')).toBeTruthy();
    expect(getByText('6d 12h remaining')).toBeTruthy();
    expect(getAllByText('Prototype Pitch & Demo').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('events-back-button')).toBeTruthy();
  });

  it('navigates back when back button is pressed', () => {
    const { getByTestId } = render(
      <EventsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const backBtn = getByTestId('events-back-button');
    fireEvent.press(backBtn);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('switches filter tab when a tab pill is pressed', () => {
    const { getByTestId } = render(
      <EventsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const upcomingTab = getByTestId('tab-upcoming');
    fireEvent.press(upcomingTab);

    expect(mockSetActiveFilter).toHaveBeenCalledWith('UPCOMING');
  });

  it('opens CreateEventModal when FAB button is pressed', () => {
    const { getByTestId, getByText } = render(
      <EventsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const fab = getByTestId('create-event-fab');
    fireEvent.press(fab);

    // Modal opens and shows title
    expect(getByText('Schedule Event')).toBeTruthy();
  });

  it('displays read-only expiration banner and hides FAB when group is expired', () => {
    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      remainingTime: {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalRemainingSeconds: 0,
        isExpiring: false,
        isExpired: true,
        progressFraction: 1.0,
        formattedText: 'Space Expired',
      },
      lifecycleState: 'EXPIRED',
      isExpiring: false,
      isExpired: true,
    });

    const { getByText, queryByTestId } = render(
      <EventsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(
      getByText(/SPACE DISSOLVED — Itinerary is archived in permanent read-only mode/),
    ).toBeTruthy();
    expect(queryByTestId('create-event-fab')).toBeNull();
  });

  it('renders empty state when there are no events', () => {
    (eventsHook.useEvents as jest.Mock).mockReturnValue({
      allEvents: [],
      filteredEvents: [],
      heroEvent: null,
      activeFilter: 'ALL',
      setActiveFilter: mockSetActiveFilter,
      isLoading: false,
      isRefreshing: false,
      error: null,
      counts: {
        all: 0,
        upcoming: 0,
        milestones: 0,
        past: 0,
      },
      refresh: mockRefresh,
      createEvent: mockCreateEvent,
      updateEvent: mockUpdateEvent,
      deleteEvent: mockDeleteEvent,
    });

    const { getByText } = render(
      <EventsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('No Itinerary Events')).toBeTruthy();
    expect(
      getByText(
        'No events or rendezvous points have been scheduled yet. Add your first milestone.',
      ),
    ).toBeTruthy();
  });
});
