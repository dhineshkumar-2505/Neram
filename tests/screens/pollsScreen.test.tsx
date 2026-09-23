import * as React from 'react';
void React;
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PollsScreen } from '../../src/features/polls/screens/PollsScreen';
import * as authHook from '../../src/hooks/useAuth';
import * as pollsHook from '../../src/features/polls/hooks/usePolls';
import * as lifecycleHook from '../../src/features/groups/hooks/useGroupLifecycle';
import { groupService } from '../../src/features/groups/services/groupService';
import type { PollRecord } from '../../src/features/polls/types';
import type { RootStackScreenProps } from '../../src/navigation/types';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/polls/hooks/usePolls');
jest.mock('../../src/features/groups/hooks/useGroupLifecycle');
jest.mock('../../src/features/groups/services/groupService');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('PollsScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
  } as unknown as RootStackScreenProps<'Polls'>['navigation'];

  const mockRoute = {
    key: 'Polls-key',
    name: 'Polls' as const,
    params: {
      groupId: 'grp_test_123',
      groupName: 'Autonomous Robotics Sprint',
    },
  } as unknown as RootStackScreenProps<'Polls'>['route'];

  const mockSamplePoll: PollRecord = {
    id: 'poll_sprint_1',
    groupId: 'grp_test_123',
    creatorId: 'user_1',
    question: 'Decide demo presentation order',
    isMultipleChoice: false,
    isClosed: false,
    closedAt: null,
    expiresAt: null,
    createdAt: '2026-09-23T10:00:00Z',
    options: [
      { id: 'opt_1', pollId: 'poll_sprint_1', optionText: 'Robotics first', sortOrder: 0, voteCount: 3, percentage: 75, isUserVoted: true },
      { id: 'opt_2', pollId: 'poll_sprint_1', optionText: 'Vision AI first', sortOrder: 1, voteCount: 1, percentage: 25, isUserVoted: false },
    ],
    totalVotes: 4,
    totalVoters: 4,
    userVotes: ['opt_1'],
    hasVoted: true,
    winningOptionIds: [],
  };

  const mockRefresh = jest.fn();
  const mockCreatePoll = jest.fn();
  const mockVote = jest.fn();
  const mockClosePoll = jest.fn();
  const mockDeletePoll = jest.fn();
  const mockSetFilterTab = jest.fn();
  const mockSetSortOption = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user_1', email: 'test@example.com' },
      profile: { username: 'testuser', display_name: 'Test Engineer' },
    });

    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      isExpired: false,
      remainingTime: '18h 45m left',
      lifecycleState: 'ACTIVE',
      totalDurationSeconds: 86400,
      elapsedSeconds: 19000,
    });

    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: {
        id: 'grp_test_123',
        name: 'Autonomous Robotics Sprint',
        starts_at: '2026-09-23T00:00:00Z',
        expires_at: '2026-09-24T00:00:00Z',
        lifecycle_state: 'ACTIVE',
      },
    });

    (pollsHook.usePolls as jest.Mock).mockReturnValue({
      polls: [mockSamplePoll],
      allPolls: [mockSamplePoll],
      isLoading: false,
      isRefreshing: false,
      error: null,
      filterTab: 'ALL',
      sortOption: 'NEWEST',
      counts: { all: 1, active: 1, closed: 0 },
      setFilterTab: mockSetFilterTab,
      setSortOption: mockSetSortOption,
      refresh: mockRefresh,
      createPoll: mockCreatePoll,
      vote: mockVote,
      closePoll: mockClosePoll,
      deletePoll: mockDeletePoll,
    });
  });

  it('renders consensus polls screen with header, tabs, and poll card', async () => {
    const { getByText, getByTestId } = render(
      <PollsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText('Consensus Polls')).toBeTruthy();
      expect(getByText('Autonomous Robotics Sprint')).toBeTruthy();
      expect(getByText('18h 45m left')).toBeTruthy();
      expect(getByText('All (1)')).toBeTruthy();
      expect(getByText('Active (1)')).toBeTruthy();
      expect(getByText('Closed (0)')).toBeTruthy();
      expect(getByText('Decide demo presentation order')).toBeTruthy();
      expect(getByTestId('create-poll-fab')).toBeTruthy();
    });
  });

  it('handles tab switching between All, Active, and Closed', async () => {
    const { getByTestId } = render(
      <PollsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByTestId('tab-active')).toBeTruthy();
    });

    fireEvent.press(getByTestId('tab-active'));
    expect(mockSetFilterTab).toHaveBeenCalledWith('ACTIVE');

    fireEvent.press(getByTestId('tab-closed'));
    expect(mockSetFilterTab).toHaveBeenCalledWith('CLOSED');
  });

  it('renders empty state when no polls exist', async () => {
    (pollsHook.usePolls as jest.Mock).mockReturnValue({
      polls: [],
      allPolls: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      filterTab: 'ALL',
      sortOption: 'NEWEST',
      counts: { all: 0, active: 0, closed: 0 },
      setFilterTab: mockSetFilterTab,
      setSortOption: mockSetSortOption,
      refresh: mockRefresh,
      createPoll: mockCreatePoll,
      vote: mockVote,
      closePoll: mockClosePoll,
      deletePoll: mockDeletePoll,
    });

    const { getByText } = render(
      <PollsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText('No Consensus Polls')).toBeTruthy();
    });
  });

  it('renders read-only freeze banner and hides FAB when group is expired', async () => {
    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      isExpired: true,
      remainingTime: 'EXPIRED',
      lifecycleState: 'EXPIRED',
    });

    const { getByText, queryByTestId } = render(
      <PollsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText(/SPACE DISSOLVED/)).toBeTruthy();
      expect(queryByTestId('create-poll-fab')).toBeNull();
    });
  });

  it('navigates back when back button is pressed', async () => {
    const { getByTestId } = render(
      <PollsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByTestId('polls-back-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('polls-back-button'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('opens CreatePollModal when FAB is pressed', async () => {
    const { getByTestId, getByText } = render(
      <PollsScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByTestId('create-poll-fab')).toBeTruthy();
    });

    fireEvent.press(getByTestId('create-poll-fab'));
    await waitFor(() => expect(getByText('New Consensus Poll')).toBeTruthy());
  });
});
