import { pollService } from '../../src/features/polls/services/pollService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('pollService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchPolls', () => {
    it('fetches polls for a group and formats domain PollRecord objects with percentages and user votes', async () => {
      const mockRawRows = [
        {
          id: 'poll_1',
          group_id: 'grp_123',
          creator_id: 'user_1',
          question: 'Where should we meet?',
          is_multiple_choice: false,
          is_closed: false,
          closed_at: null,
          expires_at: null,
          created_at: '2026-09-23T10:00:00Z',
          creator: {
            user_id: 'user_1',
            display_name: 'Alice Organizer',
            username: 'alice',
            avatar_path: null,
          },
          poll_options: [
            { id: 'opt_1', poll_id: 'poll_1', option_text: 'Beach', sort_order: 0, vote_count: 3 },
            { id: 'opt_2', poll_id: 'poll_1', option_text: 'Cafe', sort_order: 1, vote_count: 1 },
          ],
          poll_votes: [
            { poll_id: 'poll_1', option_id: 'opt_1', user_id: 'user_current' },
            { poll_id: 'poll_1', option_id: 'opt_1', user_id: 'user_2' },
            { poll_id: 'poll_1', option_id: 'opt_1', user_id: 'user_3' },
            { poll_id: 'poll_1', option_id: 'opt_2', user_id: 'user_4' },
          ],
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockRawRows, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await pollService.fetchPolls('grp_123', 'user_current');

      expect(supabase.from).toHaveBeenCalledWith('polls');
      expect(mockEq).toHaveBeenCalledWith('group_id', 'grp_123');
      expect(result.error).toBeUndefined();
      expect(result.polls).toHaveLength(1);

      const poll = result.polls[0]!;
      expect(poll.id).toBe('poll_1');
      expect(poll.question).toBe('Where should we meet?');
      expect(poll.totalVotes).toBe(4);
      expect(poll.totalVoters).toBe(4);
      expect(poll.userVotes).toEqual(['opt_1']);
      expect(poll.hasVoted).toBe(true);

      // Verify percentages: opt_1 = 3/4 = 75%, opt_2 = 1/4 = 25%
      expect(poll.options[0]!.percentage).toBe(75);
      expect(poll.options[0]!.isUserVoted).toBe(true);
      expect(poll.options[1]!.percentage).toBe(25);
      expect(poll.options[1]!.isUserVoted).toBe(false);
    });

    it('identifies tie in consensus calculation when poll is closed and top options have equal votes', async () => {
      const mockRawRows = [
        {
          id: 'poll_closed_tie',
          group_id: 'grp_123',
          creator_id: 'user_1',
          question: 'Project timeline length?',
          is_multiple_choice: false,
          is_closed: true,
          closed_at: '2026-09-23T11:00:00Z',
          expires_at: null,
          created_at: '2026-09-23T10:00:00Z',
          poll_options: [
            { id: 'opt_1', poll_id: 'poll_closed_tie', option_text: '2 weeks', sort_order: 0, vote_count: 5 },
            { id: 'opt_2', poll_id: 'poll_closed_tie', option_text: '3 weeks', sort_order: 1, vote_count: 5 },
            { id: 'opt_3', poll_id: 'poll_closed_tie', option_text: '4 weeks', sort_order: 2, vote_count: 2 },
          ],
          poll_votes: [],
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockRawRows, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await pollService.fetchPolls('grp_123', 'user_current');
      expect(result.polls).toHaveLength(1);

      const poll = result.polls[0]!;
      expect(poll.isClosed).toBe(true);
      expect(poll.isTie).toBe(true);
      expect(poll.winningOptionIds).toEqual(['opt_1', 'opt_2']);
      expect(poll.options[0]!.isWinner).toBe(true);
      expect(poll.options[1]!.isWinner).toBe(true);
      expect(poll.options[2]!.isWinner).toBe(false);
    });
  });

  describe('createPoll', () => {
    it('validates question presence and length', async () => {
      const emptyResult = await pollService.createPoll('user_1', {
        groupId: 'grp_123',
        question: '   ',
        options: ['Yes', 'No'],
      });
      expect(emptyResult.poll).toBeNull();
      expect(emptyResult.error).toContain('Poll question is required');

      const longQuestion = 'a'.repeat(251);
      const longResult = await pollService.createPoll('user_1', {
        groupId: 'grp_123',
        question: longQuestion,
        options: ['Yes', 'No'],
      });
      expect(longResult.poll).toBeNull();
      expect(longResult.error).toContain('cannot exceed 250 characters');
    });

    it('enforces minimum 2 and maximum 6 options', async () => {
      const oneOpt = await pollService.createPoll('user_1', {
        groupId: 'grp_123',
        question: 'Single option question?',
        options: ['Only one'],
      });
      expect(oneOpt.poll).toBeNull();
      expect(oneOpt.error).toContain('at least 2 options');

      const sevenOpts = await pollService.createPoll('user_1', {
        groupId: 'grp_123',
        question: 'Too many options?',
        options: ['1', '2', '3', '4', '5', '6', '7'],
      });
      expect(sevenOpts.poll).toBeNull();
      expect(sevenOpts.error).toContain('cannot exceed 6 options');
    });

    it('rejects duplicate options', async () => {
      const dupResult = await pollService.createPoll('user_1', {
        groupId: 'grp_123',
        question: 'Where to eat?',
        options: ['Pizza', 'Burger', 'pizza'],
      });
      expect(dupResult.poll).toBeNull();
      expect(dupResult.error).toContain('Duplicate option found');
    });

    it('creates poll record and batch-inserts options', async () => {
      const mockCreatedPoll = {
        id: 'new_poll_id',
        group_id: 'grp_123',
        creator_id: 'user_1',
        question: 'Launch time?',
        is_multiple_choice: true,
        expires_at: null,
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockCreatedPoll, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsertPoll = jest.fn().mockReturnValue({ select: mockSelect });

      const mockInsertOptions = jest.fn().mockResolvedValue({ error: null });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'polls') {
          return {
            insert: mockInsertPoll,
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    ...mockCreatedPoll,
                    is_closed: false,
                    closed_at: null,
                    created_at: '2026-09-23T12:00:00Z',
                    poll_options: [
                      { id: 'opt_1', poll_id: 'new_poll_id', option_text: 'Morning', sort_order: 0, vote_count: 0 },
                      { id: 'opt_2', poll_id: 'new_poll_id', option_text: 'Evening', sort_order: 1, vote_count: 0 },
                    ],
                    poll_votes: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'poll_options') {
          return { insert: mockInsertOptions };
        }
        return {};
      });

      const res = await pollService.createPoll('user_1', {
        groupId: 'grp_123',
        question: 'Launch time?',
        options: ['Morning', 'Evening'],
        isMultipleChoice: true,
      });

      expect(res.poll).not.toBeNull();
      expect(res.poll?.id).toBe('new_poll_id');
      expect(res.poll?.isMultipleChoice).toBe(true);
      expect(mockInsertOptions).toHaveBeenCalledWith([
        { poll_id: 'new_poll_id', option_text: 'Morning', sort_order: 0, vote_count: 0 },
        { poll_id: 'new_poll_id', option_text: 'Evening', sort_order: 1, vote_count: 0 },
      ]);
    });
  });

  describe('castVote', () => {
    it('calls cast_poll_vote RPC and returns action result', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true, action: 'VOTED', poll_id: 'p1', option_id: 'o1' },
        error: null,
      });

      const res = await pollService.castVote('p1', 'o1');

      expect(supabase.rpc).toHaveBeenCalledWith('cast_poll_vote', {
        p_poll_id: 'p1',
        p_option_id: 'o1',
      });
      expect(res.success).toBe(true);
      expect(res.action).toBe('VOTED');
    });

    it('returns error when cast_poll_vote RPC fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Poll has been closed.' },
      });

      const res = await pollService.castVote('p1', 'o1');

      expect(res.success).toBe(false);
      expect(res.error).toBe('Poll has been closed.');
    });
  });

  describe('closePoll', () => {
    it('calls close_poll RPC and returns success', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const res = await pollService.closePoll('p1');

      expect(supabase.rpc).toHaveBeenCalledWith('close_poll', { p_poll_id: 'p1' });
      expect(res.success).toBe(true);
    });
  });

  describe('deletePoll', () => {
    it('deletes poll record by ID', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const res = await pollService.deletePoll('p1');

      expect(supabase.from).toHaveBeenCalledWith('polls');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'p1');
      expect(res.success).toBe(true);
    });
  });
});
