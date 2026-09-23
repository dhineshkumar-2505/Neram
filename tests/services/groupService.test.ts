import { groupService } from '../../src/features/groups/services/groupService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('groupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('creates a temporary group with valid parameters', async () => {
      const mockCreatedGroup = {
        id: 'group_123',
        owner_id: 'user_owner',
        name: 'Weekend Hackathon',
        description: 'Building Neram components',
        purpose: 'HACKATHON',
        starts_at: '2026-09-23T10:00:00.000Z',
        expires_at: '2026-09-24T10:00:00.000Z',
        lifecycle_state: 'ACTIVE',
        created_at: '2026-09-23T10:00:00.000Z',
        updated_at: '2026-09-23T10:00:00.000Z',
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: mockCreatedGroup,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await groupService.createGroup(
        {
          name: '  Weekend Hackathon  ',
          description: '  Building Neram components  ',
          purpose: 'HACKATHON',
          duration: { months: 0, days: 1, hours: 0 },
        },
        'user_owner',
      );

      expect(result.error).toBeUndefined();
      expect(result.group).toEqual(mockCreatedGroup);

      // Verify trimmed values sent to database
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Weekend Hackathon',
          description: 'Building Neram components',
          purpose: 'HACKATHON',
          owner_id: 'user_owner',
          lifecycle_state: 'ACTIVE',
        }),
      );
    });

    it('rejects group creation with empty or whitespace-only name', async () => {
      const result = await groupService.createGroup(
        {
          name: '   ',
          purpose: 'OUTING',
          duration: { months: 0, days: 0, hours: 4 },
        },
        'user_owner',
      );

      expect(result.group).toBeNull();
      expect(result.error).toBe('Space name is required (1 to 80 characters).');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('rejects group creation when name exceeds 80 characters (PostgreSQL constraint chk_group_name_length)', async () => {
      const longName = 'A'.repeat(81);
      const result = await groupService.createGroup(
        {
          name: longName,
          purpose: 'PROJECT',
          duration: { months: 1, days: 0, hours: 0 },
        },
        'user_owner',
      );

      expect(result.group).toBeNull();
      expect(result.error).toBe('Space name cannot exceed 80 characters.');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('rejects group creation when description exceeds 500 characters', async () => {
      const longDesc = 'D'.repeat(501);
      const result = await groupService.createGroup(
        {
          name: 'Valid Name',
          description: longDesc,
          purpose: 'PROJECT',
          duration: { months: 1, days: 0, hours: 0 },
        },
        'user_owner',
      );

      expect(result.group).toBeNull();
      expect(result.error).toBe('Description cannot exceed 500 characters.');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('invites initial mutual friends while ignoring duplicate and owner IDs', async () => {
      const mockCreatedGroup = {
        id: 'group_456',
        owner_id: 'user_owner',
        name: 'Outing Group',
        description: null,
        purpose: 'OUTING',
        starts_at: '2026-09-23T10:00:00.000Z',
        expires_at: '2026-09-23T14:00:00.000Z',
        lifecycle_state: 'ACTIVE',
      };

      const mockGroupSingle = jest.fn().mockResolvedValueOnce({
        data: mockCreatedGroup,
        error: null,
      });
      const mockGroupSelect = jest.fn().mockReturnValue({ single: mockGroupSingle });
      const mockGroupInsert = jest.fn().mockReturnValue({ select: mockGroupSelect });

      const mockMemberInsert = jest.fn().mockResolvedValueOnce({
        error: null,
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'groups') {
          return { insert: mockGroupInsert };
        }
        if (table === 'group_members') {
          return { insert: mockMemberInsert };
        }
        return {};
      });

      const result = await groupService.createGroup(
        {
          name: 'Outing Group',
          purpose: 'OUTING',
          duration: { months: 0, days: 0, hours: 4 },
          initialMemberIds: ['friend_1', 'friend_2', 'friend_1', 'user_owner'],
        },
        'user_owner',
      );

      expect(result.error).toBeUndefined();
      expect(result.group).toEqual(mockCreatedGroup);

      // Verify group_members called with unique non-owner friend IDs
      expect(mockMemberInsert).toHaveBeenCalledWith([
        { group_id: 'group_456', user_id: 'friend_1', role: 'MEMBER' },
        { group_id: 'group_456', user_id: 'friend_2', role: 'MEMBER' },
      ]);
    });

    it('handles database check constraint or RLS insertion errors', async () => {
      const mockGroupSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'new row for relation "groups" violates check constraint' },
      });
      const mockGroupSelect = jest.fn().mockReturnValue({ single: mockGroupSingle });
      const mockGroupInsert = jest.fn().mockReturnValue({ select: mockGroupSelect });

      (supabase.from as jest.Mock).mockReturnValue({ insert: mockGroupInsert });

      const result = await groupService.createGroup(
        {
          name: 'Invalid Space',
          purpose: 'OUTING',
          duration: { months: 0, days: 0, hours: 4 },
        },
        'user_owner',
      );

      expect(result.group).toBeNull();
      expect(result.error).toContain('violates check constraint');
    });
  });

  describe('fetchUserGroups', () => {
    it('fetches groups and maps user membership', async () => {
      const mockRows = [
        {
          id: 'group_1',
          owner_id: 'user_123',
          name: 'My Owned Space',
          description: null,
          image_path: null,
          purpose: 'PROJECT',
          starts_at: '2026-09-23T10:00:00Z',
          expires_at: '2026-10-23T10:00:00Z',
          lifecycle_state: 'ACTIVE',
          created_at: '2026-09-23T10:00:00Z',
          updated_at: '2026-09-23T10:00:00Z',
          group_members: [{ user_id: 'user_123', left_at: null }],
        },
      ];

      const mockOrder = jest.fn().mockResolvedValueOnce({
        data: mockRows,
        error: null,
      });
      const mockIs = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const res = await groupService.fetchUserGroups('user_123');

      expect(res.error).toBeUndefined();
      expect(res.groups).toHaveLength(1);
      expect(res.groups[0]?.name).toBe('My Owned Space');
      expect(res.groups[0]?.is_owner).toBe(true);
    });

    it('returns error when query fails', async () => {
      const mockOrder = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection timeout' },
      });
      const mockIs = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const res = await groupService.fetchUserGroups('user_123');

      expect(res.groups).toEqual([]);
      expect(res.error).toBe('Database connection timeout');
    });
  });

  describe('fetchGroupDetails', () => {
    it('fetches a single group by ID', async () => {
      const mockGroup = {
        id: 'group_xyz',
        owner_id: 'user_owner',
        name: 'Target Group',
        purpose: 'SPORTS',
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: mockGroup,
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const res = await groupService.fetchGroupDetails('group_xyz');

      expect(res.error).toBeUndefined();
      expect(res.group).toEqual(
        expect.objectContaining({
          id: 'group_xyz',
          owner_id: 'user_owner',
          name: 'Target Group',
          purpose: 'SPORTS',
          members: [],
          features: [],
        }),
      );
    });

    it('returns error if group does not exist', async () => {
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Row not found' },
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const res = await groupService.fetchGroupDetails('invalid_id');

      expect(res.group).toBeNull();
      expect(res.error).toBe('Row not found');
    });
  });
});
