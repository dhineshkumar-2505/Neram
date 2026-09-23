import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePolls } from '../../src/features/polls/hooks/usePolls';
import { pollService } from '../../src/features/polls/services/pollService';
import { supabase } from '../../src/lib/supabase';
import type { PollRecord } from '../../src/features/polls/types';

jest.mock('../../src/features/polls/services/pollService');
jest.mock('../../src/lib/supabase');

describe('usePolls hook', () => {
  const mockPolls: PollRecord[] = [
    {
      id: 'poll_1',
      groupId: 'grp_123',
      creatorId: 'user_1',
      question: 'Which framework?',
      isMultipleChoice: false,
      isClosed: false,
      closedAt: null,
      expiresAt: null,
      createdAt: '2026-09-23T08:00:00Z',
      options: [
        { id: 'opt_1', pollId: 'poll_1', optionText: 'React Native', sortOrder: 0, voteCount: 2, percentage: 67, isUserVoted: false },
        { id: 'opt_2', pollId: 'poll_1', optionText: 'Flutter', sortOrder: 1, voteCount: 1, percentage: 33, isUserVoted: false },
      ],
      totalVotes: 3,
      totalVoters: 3,
      userVotes: [],
      hasVoted: false,
      winningOptionIds: [],
    },
    {
      id: 'poll_2',
      groupId: 'grp_123',
      creatorId: 'user_1',
      question: 'Meeting venue?',
      isMultipleChoice: true,
      isClosed: true,
      closedAt: '2026-09-23T09:00:00Z',
      expiresAt: null,
      createdAt: '2026-09-23T07:00:00Z',
      options: [
        { id: 'opt_3', pollId: 'poll_2', optionText: 'Office', sortOrder: 0, voteCount: 4, percentage: 80, isUserVoted: true, isWinner: true },
        { id: 'opt_4', pollId: 'poll_2', optionText: 'Cafe', sortOrder: 1, voteCount: 1, percentage: 20, isUserVoted: false, isWinner: false },
      ],
      totalVotes: 5,
      totalVoters: 4,
      userVotes: ['opt_3'],
      hasVoted: true,
      winningOptionIds: ['opt_3'],
    },
  ];

  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (pollService.fetchPolls as jest.Mock).mockResolvedValue({
      polls: mockPolls,
    });
    (pollService.fetchPoll as jest.Mock).mockImplementation((pollId: string) => {
      const poll = mockPolls.find((p) => p.id === pollId) || null;
      return Promise.resolve({ poll });
    });
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    (supabase.removeChannel as jest.Mock).mockReturnValue(Promise.resolve());
  });

  it('loads polls and computes dynamic counts for All, Active, and Closed tabs', async () => {
    const { result } = renderHook(() =>
      usePolls({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.polls).toHaveLength(2);
    expect(result.current.counts).toEqual({
      all: 2,
      active: 1,
      closed: 1,
    });
  });

  it('filters polls by ACTIVE tab', async () => {
    const { result } = renderHook(() =>
      usePolls({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilterTab('ACTIVE');
    });

    expect(result.current.polls).toHaveLength(1);
    expect(result.current.polls[0]!.id).toBe('poll_1');
    expect(result.current.polls[0]!.isClosed).toBe(false);
  });

  it('filters polls by CLOSED tab', async () => {
    const { result } = renderHook(() =>
      usePolls({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilterTab('CLOSED');
    });

    expect(result.current.polls).toHaveLength(1);
    expect(result.current.polls[0]!.id).toBe('poll_2');
    expect(result.current.polls[0]!.isClosed).toBe(true);
  });

  it('optimistically updates vote counts and percentages on voting', async () => {
    (pollService.castVote as jest.Mock).mockResolvedValue({
      success: true,
      action: 'VOTED',
    });

    const { result } = renderHook(() =>
      usePolls({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { success: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.vote('poll_1', 'opt_1');
    });

    expect(res?.success).toBe(true);
    expect(pollService.castVote).toHaveBeenCalledWith('poll_1', 'opt_1');

    // Poll 1 opt_1 had 2 votes out of 3 (67%). With user_1 vote, it now has 3 out of 4 (75%).
    const updated = result.current.allPolls.find((p) => p.id === 'poll_1');
    expect(updated?.userVotes).toContain('opt_1');
    expect(updated?.hasVoted).toBe(true);
    expect(updated?.options[0]!.voteCount).toBe(3);
    expect(updated?.options[0]!.percentage).toBe(75);
  });

  it('rolls back optimistic vote on backend mutation error', async () => {
    (pollService.castVote as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Cannot vote in an expired group.',
    });

    const { result } = renderHook(() =>
      usePolls({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { success: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.vote('poll_1', 'opt_1');
    });

    expect(res?.success).toBe(false);
    expect(result.current.error).toBe('Cannot vote in an expired group.');

    // State reverted
    const reverted = result.current.allPolls.find((p) => p.id === 'poll_1');
    expect(reverted?.userVotes).toEqual([]);
    expect(reverted?.options[0]!.voteCount).toBe(2);
  });

  it('blocks voting and mutations when isExpired is true (lifecycle freeze)', async () => {
    const { result } = renderHook(() =>
      usePolls({ groupId: 'grp_123', currentUserId: 'user_1', isExpired: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let voteRes: { success: boolean; error?: string } | undefined;
    await act(async () => {
      voteRes = await result.current.vote('poll_1', 'opt_1');
    });

    expect(voteRes?.success).toBe(false);
    expect(pollService.castVote).not.toHaveBeenCalled();

    let createRes: { poll: PollRecord | null; error?: string } | undefined;
    await act(async () => {
      createRes = await result.current.createPoll({
        question: 'Blocked?',
        options: ['Yes', 'No'],
      });
    });

    expect(createRes?.poll).toBeNull();
    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  it('optimistically closes a poll and calls pollService.closePoll', async () => {
    (pollService.closePoll as jest.Mock).mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() =>
      usePolls({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { success: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.closePoll('poll_1');
    });

    expect(res?.success).toBe(true);
    expect(pollService.closePoll).toHaveBeenCalledWith('poll_1');

    const closed = result.current.allPolls.find((p) => p.id === 'poll_1');
    expect(closed?.isClosed).toBe(true);
  });
});
