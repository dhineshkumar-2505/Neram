import { supabase } from '../../../lib/supabase';
import type {
  PollRecord,
  PollOptionRecord,
  CreatePollInput,
  FetchPollsResult,
  SinglePollResult,
  VoteMutationResult,
  PollMutationResult,
} from '../types';

interface RawPollOption {
  id: string;
  poll_id: string;
  option_text: string;
  sort_order: number;
  vote_count: number | null;
}

interface RawPollVote {
  poll_id: string;
  option_id: string;
  user_id: string;
}

interface RawPollRow {
  id: string;
  group_id: string;
  creator_id: string;
  question: string;
  is_multiple_choice: boolean;
  is_closed: boolean;
  closed_at: string | null;
  expires_at: string | null;
  created_at: string;
  creator?: {
    user_id: string;
    display_name: string | null;
    username: string | null;
    avatar_path: string | null;
  } | null;
  poll_options?: RawPollOption[] | null;
  poll_votes?: RawPollVote[] | null;
}

/**
 * Transforms raw joined database poll rows into authoritative domain PollRecord.
 */
function mapPollRowToRecord(row: RawPollRow, currentUserId?: string): PollRecord {
  const optionsRaw = Array.isArray(row.poll_options) ? row.poll_options : [];
  const votesRaw = Array.isArray(row.poll_votes) ? row.poll_votes : [];

  // Sort options by sort_order
  const sortedOptions = [...optionsRaw].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Determine current user's votes
  const userVotes: string[] = [];
  const distinctVoters = new Set<string>();

  for (const v of votesRaw) {
    if (v.user_id) {
      distinctVoters.add(v.user_id);
      if (currentUserId && v.user_id === currentUserId) {
        userVotes.push(v.option_id);
      }
    }
  }

  // Calculate total votes across options
  let totalVotes = 0;
  for (const opt of sortedOptions) {
    totalVotes += opt.vote_count ?? 0;
  }

  // Check if poll is closed or expired
  const isExpired = Boolean(row.expires_at && new Date(row.expires_at).getTime() <= Date.now());
  const isClosedOrExpired = row.is_closed || isExpired;

  // Find max votes for winner/tie computation
  let maxVotes = 0;
  for (const opt of sortedOptions) {
    const count = opt.vote_count ?? 0;
    if (count > maxVotes) {
      maxVotes = count;
    }
  }

  const winningOptionIds: string[] = [];
  if (isClosedOrExpired && maxVotes > 0) {
    for (const opt of sortedOptions) {
      if ((opt.vote_count ?? 0) === maxVotes) {
        winningOptionIds.push(opt.id);
      }
    }
  }

  const isTie = winningOptionIds.length > 1;

  // Map options to PollOptionRecord
  const options: PollOptionRecord[] = sortedOptions.map((opt) => {
    const count = opt.vote_count ?? 0;
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const isUserVoted = userVotes.includes(opt.id);
    const isWinner = isClosedOrExpired && maxVotes > 0 && count === maxVotes;

    return {
      id: opt.id,
      pollId: opt.poll_id,
      optionText: opt.option_text,
      sortOrder: opt.sort_order ?? 0,
      voteCount: count,
      percentage,
      isUserVoted,
      isWinner,
    };
  });

  return {
    id: row.id,
    groupId: row.group_id,
    creatorId: row.creator_id,
    question: row.question,
    isMultipleChoice: row.is_multiple_choice,
    isClosed: row.is_closed,
    closedAt: row.closed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    options,
    totalVotes,
    totalVoters: distinctVoters.size,
    userVotes,
    hasVoted: userVotes.length > 0,
    isTie,
    winningOptionIds,
    creator: row.creator
      ? {
          userId: row.creator.user_id,
          displayName: row.creator.display_name || row.creator.username || 'Member',
          username: row.creator.username || '',
          avatarUrl: row.creator.avatar_path || null,
        }
      : undefined,
  };
}

export const pollService = {
  /**
   * Fetches all polls for a temporary group with full options, vote counts, and user vote state.
   */
  async fetchPolls(groupId: string, currentUserId?: string): Promise<FetchPollsResult> {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select(`
          id,
          group_id,
          creator_id,
          question,
          is_multiple_choice,
          is_closed,
          closed_at,
          expires_at,
          created_at,
          creator:profiles!polls_creator_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          ),
          poll_options(
            id,
            poll_id,
            option_text,
            sort_order,
            vote_count
          ),
          poll_votes(
            poll_id,
            option_id,
            user_id
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) {
        return { polls: [], error: error.message };
      }

      const polls = ((data || []) as unknown as RawPollRow[]).map((r) =>
        mapPollRowToRecord(r, currentUserId),
      );

      return { polls };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch polls.';
      return { polls: [], error: message };
    }
  },

  /**
   * Fetches a single poll by ID.
   */
  async fetchPoll(pollId: string, currentUserId?: string): Promise<SinglePollResult> {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select(`
          id,
          group_id,
          creator_id,
          question,
          is_multiple_choice,
          is_closed,
          closed_at,
          expires_at,
          created_at,
          creator:profiles!polls_creator_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          ),
          poll_options(
            id,
            poll_id,
            option_text,
            sort_order,
            vote_count
          ),
          poll_votes(
            poll_id,
            option_id,
            user_id
          )
        `)
        .eq('id', pollId)
        .maybeSingle();

      if (error) {
        return { poll: null, error: error.message };
      }
      if (!data) {
        return { poll: null, error: 'Poll not found.' };
      }

      const poll = mapPollRowToRecord(data as unknown as RawPollRow, currentUserId);
      return { poll };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch poll.';
      return { poll: null, error: message };
    }
  },

  /**
   * Validates and creates a new poll with 2–6 distinct options.
   */
  async createPoll(creatorId: string, input: CreatePollInput): Promise<SinglePollResult> {
    try {
      const question = input.question?.trim();
      if (!question || question.length === 0) {
        return { poll: null, error: 'Poll question is required.' };
      }
      if (question.length > 250) {
        return { poll: null, error: 'Poll question cannot exceed 250 characters.' };
      }

      const rawOptions = (input.options || []).map((o) => o?.trim()).filter(Boolean);
      if (rawOptions.length < 2) {
        return { poll: null, error: 'A poll must have at least 2 options.' };
      }
      if (rawOptions.length > 6) {
        return { poll: null, error: 'A poll cannot exceed 6 options.' };
      }

      // Check for duplicate options (case-insensitive)
      const seen = new Set<string>();
      for (const opt of rawOptions) {
        const lower = opt.toLowerCase();
        if (seen.has(lower)) {
          return { poll: null, error: `Duplicate option found: "${opt}". Each option must be unique.` };
        }
        if (opt.length > 120) {
          return { poll: null, error: `Option text exceeds 120 characters: "${opt}".` };
        }
        seen.add(lower);
      }

      // Compute expiresAt if duration specified
      let expiresAt: string | null = null;
      if (input.expiresAt) {
        expiresAt = input.expiresAt;
      } else if (input.durationHours && input.durationHours > 0) {
        expiresAt = new Date(Date.now() + input.durationHours * 3600 * 1000).toISOString();
      }

      // 1. Insert into public.polls
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .insert({
          group_id: input.groupId,
          creator_id: creatorId,
          question,
          is_multiple_choice: Boolean(input.isMultipleChoice),
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (pollError || !pollData) {
        return { poll: null, error: pollError?.message || 'Failed to create poll.' };
      }

      // 2. Batch insert options into public.poll_options
      const optionRows = rawOptions.map((text, idx) => ({
        poll_id: pollData.id,
        option_text: text,
        sort_order: idx,
        vote_count: 0,
      }));

      const { error: optionsError } = await supabase
        .from('poll_options')
        .insert(optionRows);

      if (optionsError) {
        // Rollback created poll on options failure
        await supabase.from('polls').delete().eq('id', pollData.id);
        return { poll: null, error: optionsError.message };
      }

      // 3. Return full newly created poll
      return await this.fetchPoll(pollData.id, creatorId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create poll.';
      return { poll: null, error: message };
    }
  },

  /**
   * Casts or toggles a vote using the atomic cast_poll_vote RPC.
   * Handles single-choice atomic replacement and multi-choice toggles.
   */
  async castVote(pollId: string, optionId: string): Promise<VoteMutationResult> {
    try {
      const { data, error } = await supabase.rpc('cast_poll_vote', {
        p_poll_id: pollId,
        p_option_id: optionId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as { success?: boolean; action?: 'VOTED' | 'RETRACTED' } | null;
      return {
        success: Boolean(res?.success),
        action: res?.action,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cast vote.';
      return { success: false, error: message };
    }
  },

  /**
   * Closes an active poll using the close_poll RPC.
   */
  async closePoll(pollId: string): Promise<PollMutationResult> {
    try {
      const { data, error } = await supabase.rpc('close_poll', {
        p_poll_id: pollId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as { success?: boolean } | null;
      return { success: Boolean(res?.success) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to close poll.';
      return { success: false, error: message };
    }
  },

  /**
   * Deletes a poll (creator or group admin only).
   */
  async deletePoll(pollId: string): Promise<PollMutationResult> {
    try {
      const { error } = await supabase.from('polls').delete().eq('id', pollId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete poll.';
      return { success: false, error: message };
    }
  },
};
