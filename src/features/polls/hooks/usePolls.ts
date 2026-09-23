import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { pollService } from '../services/pollService';
import type {
  PollRecord,
  PollOptionRecord,
  CreatePollInput,
  PollFilterTab,
  PollSortOption,
  VoteMutationResult,
  PollMutationResult,
  SinglePollResult,
} from '../types';

export interface UsePollsOptions {
  groupId: string;
  currentUserId?: string;
  isExpired?: boolean;
}

export interface UsePollsResult {
  polls: PollRecord[];
  allPolls: PollRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  filterTab: PollFilterTab;
  sortOption: PollSortOption;
  counts: { all: number; active: number; closed: number };
  setFilterTab: (tab: PollFilterTab) => void;
  setSortOption: (sort: PollSortOption) => void;
  refresh: () => Promise<void>;
  createPoll: (input: Omit<CreatePollInput, 'groupId'>) => Promise<SinglePollResult>;
  vote: (pollId: string, optionId: string) => Promise<VoteMutationResult>;
  closePoll: (pollId: string) => Promise<PollMutationResult>;
  deletePoll: (pollId: string) => Promise<PollMutationResult>;
}

export function usePolls({
  groupId,
  currentUserId,
  isExpired = false,
}: UsePollsOptions): UsePollsResult {
  const [allPolls, setAllPolls] = useState<PollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<PollFilterTab>('ALL');
  const [sortOption, setSortOption] = useState<PollSortOption>('NEWEST');

  const isMountedRef = useRef(true);

  // Initial fetch
  const loadPolls = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await pollService.fetchPolls(groupId, currentUserId);
      if (!isMountedRef.current) return;
      if (res.error) {
        setError(res.error);
      } else {
        setAllPolls(res.polls);
        setError(null);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load polls.';
      setError(message);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [groupId, currentUserId]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    loadPolls();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadPolls]);

  // Realtime subscription setup
  useEffect(() => {
    if (!groupId) return;

    const channelName = `group-polls-${groupId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          if (!isMountedRef.current) return;

          if (payload.eventType === 'INSERT') {
            const newPollRes = await pollService.fetchPoll(payload.new.id, currentUserId);
            if (isMountedRef.current && newPollRes.poll) {
              setAllPolls((prev) => {
                if (prev.some((p) => p.id === newPollRes.poll?.id)) return prev;
                return [newPollRes.poll!, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPollRes = await pollService.fetchPoll(payload.new.id, currentUserId);
            if (isMountedRef.current && updatedPollRes.poll) {
              setAllPolls((prev) =>
                prev.map((p) => (p.id === updatedPollRes.poll?.id ? updatedPollRes.poll! : p)),
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setAllPolls((prev) => prev.filter((p) => p.id !== deletedId));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes',
        },
        async (payload) => {
          if (!isMountedRef.current) return;
          const newRow = payload.new as Record<string, unknown> | null;
          const oldRow = payload.old as Record<string, unknown> | null;
          const pollId = (newRow?.poll_id || oldRow?.poll_id) as string | undefined;
          if (!pollId) return;

          // Check if poll belongs to current list
          setAllPolls((prev) => {
            const pollExists = prev.some((p) => p.id === pollId);
            if (pollExists) {
              pollService.fetchPoll(pollId, currentUserId).then((freshRes) => {
                if (isMountedRef.current && freshRes.poll) {
                  setAllPolls((current) =>
                    current.map((p) => (p.id === freshRes.poll?.id ? freshRes.poll! : p)),
                  );
                }
              });
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPolls();
  }, [loadPolls]);

  // Create Poll
  const createPoll = useCallback(
    async (input: Omit<CreatePollInput, 'groupId'>): Promise<SinglePollResult> => {
      if (isExpired) {
        Alert.alert(
          'Space Expired',
          'This temporary space is expired and read-only. No new polls can be created.',
          [{ text: 'Understood' }],
        );
        return { poll: null, error: 'Group has expired and is read-only.' };
      }

      if (!currentUserId) {
        return { poll: null, error: 'User is unauthenticated.' };
      }

      const res = await pollService.createPoll(currentUserId, {
        ...input,
        groupId,
      });

      if (res.poll) {
        setAllPolls((prev) => [res.poll!, ...prev.filter((p) => p.id !== res.poll?.id)]);
      }

      return res;
    },
    [groupId, currentUserId, isExpired],
  );

  // Cast or Retract Vote with Optimistic Update
  const vote = useCallback(
    async (pollId: string, optionId: string): Promise<VoteMutationResult> => {
      if (isExpired) {
        Alert.alert(
          'Space Expired',
          'This space is expired. Voting has been frozen.',
          [{ text: 'Understood' }],
        );
        return { success: false, error: 'Group expired' };
      }

      const poll = allPolls.find((p) => p.id === pollId);
      if (!poll) {
        return { success: false, error: 'Poll not found.' };
      }

      const isPollExpired = Boolean(
        poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now(),
      );
      if (poll.isClosed || isPollExpired) {
        Alert.alert('Poll Closed', 'This poll is no longer accepting votes.', [
          { text: 'Understood' },
        ]);
        return { success: false, error: 'Poll is closed.' };
      }

      // Snapshot for rollback
      const previousPolls = allPolls;

      // Optimistic computation
      setAllPolls((prev) =>
        prev.map((p) => {
          if (p.id !== pollId) return p;

          const isMulti = p.isMultipleChoice;
          const userAlreadyVotedForThis = p.userVotes.includes(optionId);

          let nextUserVotes: string[];
          let nextOptions: PollOptionRecord[];

          if (isMulti) {
            if (userAlreadyVotedForThis) {
              // Retract
              nextUserVotes = p.userVotes.filter((id) => id !== optionId);
              nextOptions = p.options.map((opt) =>
                opt.id === optionId
                  ? { ...opt, voteCount: Math.max(0, opt.voteCount - 1), isUserVoted: false }
                  : opt,
              );
            } else {
              // Add
              nextUserVotes = [...p.userVotes, optionId];
              nextOptions = p.options.map((opt) =>
                opt.id === optionId
                  ? { ...opt, voteCount: opt.voteCount + 1, isUserVoted: true }
                  : opt,
              );
            }
          } else {
            // Single choice
            if (userAlreadyVotedForThis) {
              // Retract vote
              nextUserVotes = [];
              nextOptions = p.options.map((opt) =>
                opt.id === optionId
                  ? { ...opt, voteCount: Math.max(0, opt.voteCount - 1), isUserVoted: false }
                  : opt,
              );
            } else {
              // Replace vote
              nextUserVotes = [optionId];
              nextOptions = p.options.map((opt) => {
                if (opt.id === optionId) {
                  return { ...opt, voteCount: opt.voteCount + 1, isUserVoted: true };
                }
                if (p.userVotes.includes(opt.id)) {
                  return { ...opt, voteCount: Math.max(0, opt.voteCount - 1), isUserVoted: false };
                }
                return opt;
              });
            }
          }

          // Recalculate total votes and percentages
          let nextTotalVotes = 0;
          for (const opt of nextOptions) {
            nextTotalVotes += opt.voteCount;
          }

          nextOptions = nextOptions.map((opt) => ({
            ...opt,
            percentage:
              nextTotalVotes > 0 ? Math.round((opt.voteCount / nextTotalVotes) * 100) : 0,
          }));

          return {
            ...p,
            options: nextOptions,
            totalVotes: nextTotalVotes,
            userVotes: nextUserVotes,
            hasVoted: nextUserVotes.length > 0,
          };
        }),
      );

      const res = await pollService.castVote(pollId, optionId);

      if (!res.success) {
        // Rollback
        setAllPolls(previousPolls);
        setError(res.error || 'Failed to submit vote.');
      }

      return res;
    },
    [allPolls, isExpired],
  );

  // Close Poll
  const closePoll = useCallback(
    async (pollId: string): Promise<PollMutationResult> => {
      if (isExpired) {
        Alert.alert(
          'Space Expired',
          'This space is expired. Poll status cannot be changed.',
          [{ text: 'Understood' }],
        );
        return { success: false, error: 'Group expired' };
      }

      const previousPolls = allPolls;

      // Optimistic close
      setAllPolls((prev) =>
        prev.map((p) =>
          p.id === pollId
            ? { ...p, isClosed: true, closedAt: new Date().toISOString() }
            : p,
        ),
      );

      const res = await pollService.closePoll(pollId);

      if (!res.success) {
        setAllPolls(previousPolls);
        setError(res.error || 'Failed to close poll.');
      }

      return res;
    },
    [allPolls, isExpired],
  );

  // Delete Poll
  const deletePoll = useCallback(
    async (pollId: string): Promise<PollMutationResult> => {
      if (isExpired) {
        Alert.alert('Space Expired', 'This space is expired and read-only.', [
          { text: 'Understood' },
        ]);
        return { success: false, error: 'Group expired' };
      }

      const previousPolls = allPolls;
      setAllPolls((prev) => prev.filter((p) => p.id !== pollId));

      const res = await pollService.deletePoll(pollId);
      if (!res.success) {
        setAllPolls(previousPolls);
        setError(res.error || 'Failed to delete poll.');
      }

      return res;
    },
    [allPolls, isExpired],
  );

  // Filter and Sort
  const { filteredPolls, counts } = useMemo(() => {
    const now = Date.now();

    let activeCount = 0;
    let closedCount = 0;

    for (const p of allPolls) {
      const isPastExpiry = Boolean(p.expiresAt && new Date(p.expiresAt).getTime() <= now);
      if (p.isClosed || isPastExpiry) {
        closedCount++;
      } else {
        activeCount++;
      }
    }

    let list = allPolls;

    if (filterTab === 'ACTIVE') {
      list = list.filter((p) => {
        const isPastExpiry = Boolean(p.expiresAt && new Date(p.expiresAt).getTime() <= now);
        return !p.isClosed && !isPastExpiry;
      });
    } else if (filterTab === 'CLOSED') {
      list = list.filter((p) => {
        const isPastExpiry = Boolean(p.expiresAt && new Date(p.expiresAt).getTime() <= now);
        return p.isClosed || isPastExpiry;
      });
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      if (sortOption === 'MOST_VOTES') {
        return b.totalVotes - a.totalVotes;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      filteredPolls: sorted,
      counts: {
        all: allPolls.length,
        active: activeCount,
        closed: closedCount,
      },
    };
  }, [allPolls, filterTab, sortOption]);

  return {
    polls: filteredPolls,
    allPolls,
    isLoading,
    isRefreshing,
    error,
    filterTab,
    sortOption,
    counts,
    setFilterTab,
    setSortOption,
    refresh,
    createPoll,
    vote,
    closePoll,
    deletePoll,
  };
}
