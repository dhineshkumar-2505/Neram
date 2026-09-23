import { eventService } from '../../src/features/events/services/eventService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('eventService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchEvents', () => {
    it('fetches events for a group and formats domain EventRecord objects chronologically', async () => {
      const mockRawRows = [
        {
          id: 'evt_1',
          group_id: 'grp_123',
          creator_id: 'user_1',
          title: 'Design Sprint Kickoff',
          description: 'Initial review of prototypes',
          target_time: '2026-09-24T10:00:00Z',
          ends_at: '2026-09-24T11:00:00Z',
          location_name: 'Studio Alpha',
          latitude: 1.2834,
          longitude: 103.8607,
          is_milestone: true,
          created_at: '2026-09-23T10:00:00Z',
          creator: {
            user_id: 'user_1',
            display_name: 'Alice Designer',
            username: 'alice',
            avatar_path: null,
          },
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockRawRows, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await eventService.fetchEvents('grp_123', 'user_1');

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(mockEq).toHaveBeenCalledWith('group_id', 'grp_123');
      expect(mockOrder).toHaveBeenCalledWith('target_time', { ascending: true });
      expect(result.error).toBeUndefined();
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.title).toBe('Design Sprint Kickoff');
      expect(result.events[0]?.isMilestone).toBe(true);
      expect(result.events[0]?.locationName).toBe('Studio Alpha');
      expect(result.events[0]?.creator?.displayName).toBe('Alice Designer');
    });

    it('returns error when group ID is empty', async () => {
      const result = await eventService.fetchEvents('');
      expect(result.error).toBe('Group ID is required.');
      expect(result.events).toEqual([]);
    });

    it('handles database fetch failure gracefully', async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await eventService.fetchEvents('grp_fail');
      expect(result.error).toBe('Database connection failed');
      expect(result.events).toEqual([]);
    });
  });

  describe('fetchEvent', () => {
    it('fetches a single event by ID', async () => {
      const mockRow = {
        id: 'evt_single_1',
        group_id: 'grp_123',
        creator_id: 'user_2',
        title: 'Team Rendezvous',
        description: null,
        target_time: '2026-09-25T14:00:00Z',
        ends_at: null,
        location_name: 'Central Plaza',
        latitude: null,
        longitude: null,
        is_milestone: false,
        created_at: '2026-09-23T10:00:00Z',
        creator: {
          user_id: 'user_2',
          display_name: 'Bob Builder',
          username: 'bob',
          avatar_path: null,
        },
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockRow, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await eventService.fetchEvent('evt_single_1');
      expect(result.error).toBeUndefined();
      expect(result.event?.id).toBe('evt_single_1');
      expect(result.event?.title).toBe('Team Rendezvous');
      expect(result.event?.creator?.username).toBe('bob');
    });

    it('returns error if event ID is missing', async () => {
      const result = await eventService.fetchEvent('');
      expect(result.error).toBe('Event ID is required.');
      expect(result.event).toBeNull();
    });
  });

  describe('createEvent', () => {
    it('validates title and creates a new event with destination coordinates', async () => {
      const createdRow = {
        id: 'evt_new_1',
        group_id: 'grp_123',
        creator_id: 'user_1',
        title: 'Hackathon Submission',
        description: 'Submit repo and video pitch',
        target_time: '2026-09-26T18:00:00Z',
        ends_at: null,
        location_name: 'Main Stage',
        latitude: 1.3521,
        longitude: 103.8198,
        is_milestone: true,
        created_at: '2026-09-23T10:00:00Z',
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: createdRow, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await eventService.createEvent(
        {
          groupId: 'grp_123',
          title: '  Hackathon Submission  ',
          description: 'Submit repo and video pitch',
          targetTime: '2026-09-26T18:00:00Z',
          locationName: 'Main Stage',
          latitude: 1.3521,
          longitude: 103.8198,
          isMilestone: true,
        },
        'user_1',
      );

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 'grp_123',
          title: 'Hackathon Submission',
          location_name: 'Main Stage',
          latitude: 1.3521,
          longitude: 103.8198,
          is_milestone: true,
          creator_id: 'user_1',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.event?.id).toBe('evt_new_1');
      expect(result.event?.isMilestone).toBe(true);
    });

    it('rejects empty or whitespace-only title', async () => {
      const result = await eventService.createEvent({
        groupId: 'grp_123',
        title: '   ',
        targetTime: '2026-09-26T18:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event title is required.');
    });

    it('rejects title longer than 100 characters', async () => {
      const result = await eventService.createEvent({
        groupId: 'grp_123',
        title: 'A'.repeat(101),
        targetTime: '2026-09-26T18:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event title must not exceed 100 characters.');
    });

    it('rejects invalid target time', async () => {
      const result = await eventService.createEvent({
        groupId: 'grp_123',
        title: 'Valid Title',
        targetTime: 'invalid-date',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Valid target date and time is required.');
    });

    it('rejects invalid latitude or longitude bounds', async () => {
      const result = await eventService.createEvent({
        groupId: 'grp_123',
        title: 'Valid Title',
        targetTime: '2026-09-26T18:00:00Z',
        latitude: 95.0, // Invalid > 90
        longitude: 100.0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Latitude must be between -90.0 and +90.0 degrees.');
    });

    it('rejects end time before target start time', async () => {
      const result = await eventService.createEvent({
        groupId: 'grp_123',
        title: 'Valid Title',
        targetTime: '2026-09-26T18:00:00Z',
        endsAt: '2026-09-26T17:00:00Z', // 1 hour prior
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('End time must be after target start time.');
    });
  });

  describe('updateEvent', () => {
    it('updates event fields successfully', async () => {
      const updatedRow = {
        id: 'evt_1',
        group_id: 'grp_123',
        creator_id: 'user_1',
        title: 'Updated Title',
        description: 'Updated desc',
        target_time: '2026-09-27T10:00:00Z',
        ends_at: null,
        location_name: 'New Hall',
        latitude: null,
        longitude: null,
        is_milestone: false,
        created_at: '2026-09-23T10:00:00Z',
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: updatedRow, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

      const result = await eventService.updateEvent('evt_1', {
        title: 'Updated Title',
        locationName: 'New Hall',
      });

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          location_name: 'New Hall',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.event?.title).toBe('Updated Title');
    });

    it('returns error when event ID is missing', async () => {
      const result = await eventService.updateEvent('', { title: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Event ID is required.');
    });
  });

  describe('deleteEvent', () => {
    it('deletes an event by ID', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const result = await eventService.deleteEvent('evt_delete_1');
      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(mockEq).toHaveBeenCalledWith('id', 'evt_delete_1');
      expect(result.success).toBe(true);
    });

    it('returns error when deletion fails in database', async () => {
      const mockEq = jest.fn().mockResolvedValue({
        error: { message: 'Row level security policy violation' },
      });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const result = await eventService.deleteEvent('evt_delete_1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Row level security policy violation');
    });
  });
});
