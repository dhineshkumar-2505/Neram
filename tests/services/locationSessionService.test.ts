import { locationSessionService } from '../../src/features/location/services/locationSessionService';
import { supabase } from '../../src/lib/supabase';
import type { CreateSessionInput } from '../../src/features/location/types';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('locationSessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveSession', () => {
    it('returns null when no active session exists for group', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEqStatus = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEqGroup = jest.fn().mockReturnValue({ eq: mockEqStatus });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEqGroup });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await locationSessionService.getActiveSession('grp_100');

      expect(supabase.from).toHaveBeenCalledWith('location_sessions');
      expect(mockEqGroup).toHaveBeenCalledWith('group_id', 'grp_100');
      expect(mockEqStatus).toHaveBeenCalledWith('status', 'ACTIVE');
      expect(result.session).toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('returns formatted LocationSession when active session exists', async () => {
      const mockRow = {
        id: 'sess_1',
        group_id: 'grp_100',
        created_by: 'usr_owner',
        title: 'Central Park Rendezvous',
        destination_name: 'Bethesda Fountain',
        destination_lat: 40.7738,
        destination_lng: -73.9708,
        status: 'ACTIVE',
        starts_at: '2026-09-23T10:00:00Z',
        ends_at: '2026-09-23T12:00:00Z',
        ended_at: null,
        created_at: '2026-09-23T09:50:00Z',
        updated_at: '2026-09-23T09:50:00Z',
        creator: {
          user_id: 'usr_owner',
          display_name: 'Coordinator Jane',
          username: 'jane',
          avatar_path: null,
        },
      };

      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockRow, error: null });
      const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEqStatus = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEqGroup = jest.fn().mockReturnValue({ eq: mockEqStatus });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEqGroup });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await locationSessionService.getActiveSession('grp_100');

      expect(result.error).toBeUndefined();
      expect(result.session).not.toBeNull();
      expect(result.session?.id).toBe('sess_1');
      expect(result.session?.title).toBe('Central Park Rendezvous');
      expect(result.session?.destinationName).toBe('Bethesda Fountain');
      expect(result.session?.destinationLat).toBe(40.7738);
      expect(result.session?.destinationLng).toBe(-73.9708);
      expect(result.session?.creator?.displayName).toBe('Coordinator Jane');
    });

    it('returns error when query fails', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection interrupted' },
      });
      const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEqStatus = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEqGroup = jest.fn().mockReturnValue({ eq: mockEqStatus });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEqGroup });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await locationSessionService.getActiveSession('grp_100');

      expect(result.session).toBeNull();
      expect(result.error).toBe('Database connection interrupted');
    });
  });

  describe('createSession', () => {
    it('creates active session and automatically registers creator as active participant', async () => {
      const input: CreateSessionInput = {
        groupId: 'grp_100',
        title: 'Team Outing Rendezvous',
        destinationName: 'Main Entrance',
        destinationLat: 40.7128,
        destinationLng: -74.006,
        endsAt: '2026-09-23T14:00:00Z',
      };

      const mockSessionRow = {
        id: 'sess_created',
        group_id: 'grp_100',
        created_by: 'usr_me',
        title: 'Team Outing Rendezvous',
        destination_name: 'Main Entrance',
        destination_lat: 40.7128,
        destination_lng: -74.006,
        status: 'ACTIVE',
        starts_at: '2026-09-23T12:00:00Z',
        ends_at: '2026-09-23T14:00:00Z',
        ended_at: null,
        created_at: '2026-09-23T12:00:00Z',
        updated_at: '2026-09-23T12:00:00Z',
      };

      // Mock session insert
      const mockSingleSession = jest.fn().mockResolvedValue({ data: mockSessionRow, error: null });
      const mockSelectSession = jest.fn().mockReturnValue({ single: mockSingleSession });
      const mockInsertSession = jest.fn().mockReturnValue({ select: mockSelectSession });

      // Mock participant insert
      const mockInsertParticipant = jest.fn().mockResolvedValue({ error: null });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'location_sessions') {
          return { insert: mockInsertSession };
        }
        if (table === 'location_session_participants') {
          return { insert: mockInsertParticipant };
        }
        return {};
      });

      const result = await locationSessionService.createSession(input, 'usr_me');

      expect(result.error).toBeUndefined();
      expect(result.session).not.toBeNull();
      expect(result.session?.id).toBe('sess_created');
      expect(mockInsertParticipant).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess_created',
          user_id: 'usr_me',
          status: 'ACTIVE',
        }),
      );
    });

    it('rolls back session if participant auto-join fails', async () => {
      const input: CreateSessionInput = {
        groupId: 'grp_100',
        title: 'Failing Outing',
        destinationName: null,
        destinationLat: 40.7128,
        destinationLng: -74.006,
        endsAt: '2026-09-23T14:00:00Z',
      };

      const mockSessionRow = {
        id: 'sess_created_rollback',
        group_id: 'grp_100',
        created_by: 'usr_me',
        title: 'Failing Outing',
        destination_name: null,
        destination_lat: 40.7128,
        destination_lng: -74.006,
        status: 'ACTIVE',
        starts_at: '2026-09-23T12:00:00Z',
        ends_at: '2026-09-23T14:00:00Z',
        ended_at: null,
        created_at: '2026-09-23T12:00:00Z',
        updated_at: '2026-09-23T12:00:00Z',
      };

      const mockSingleSession = jest.fn().mockResolvedValue({ data: mockSessionRow, error: null });
      const mockSelectSession = jest.fn().mockReturnValue({ single: mockSingleSession });
      const mockInsertSession = jest.fn().mockReturnValue({ select: mockSelectSession });
      const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
      const mockDeleteSession = jest.fn().mockReturnValue({ eq: mockDeleteEq });

      // Participant fails
      const mockInsertParticipant = jest.fn().mockResolvedValue({
        error: { message: 'Participant RLS rejection' },
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'location_sessions') {
          return {
            insert: mockInsertSession,
            delete: mockDeleteSession,
          };
        }
        if (table === 'location_session_participants') {
          return { insert: mockInsertParticipant };
        }
        return {};
      });

      const result = await locationSessionService.createSession(input, 'usr_me');

      expect(result.session).toBeNull();
      expect(result.error).toBe('Participant RLS rejection');
      expect(mockDeleteSession).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith('id', 'sess_created_rollback');
    });
  });

  describe('joinSession', () => {
    it('upserts participant status as ACTIVE', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

      const result = await locationSessionService.joinSession('sess_1', 'usr_member');

      expect(supabase.from).toHaveBeenCalledWith('location_session_participants');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess_1',
          user_id: 'usr_member',
          status: 'ACTIVE',
          left_at: null,
        }),
        { onConflict: 'session_id,user_id' },
      );
      expect(result.success).toBe(true);
    });

    it('returns error if upsert fails', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({
        error: { message: 'Failed to join session' },
      });
      (supabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

      const result = await locationSessionService.joinSession('sess_1', 'usr_member');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to join session');
    });
  });

  describe('leaveSession', () => {
    it('marks participant as LEFT and cleans up current_locations', async () => {
      const mockParticipantEqUser = jest.fn().mockResolvedValue({ error: null });
      const mockParticipantEqSession = jest.fn().mockReturnValue({ eq: mockParticipantEqUser });
      const mockParticipantUpdate = jest.fn().mockReturnValue({ eq: mockParticipantEqSession });

      const mockLocationEqUser = jest.fn().mockResolvedValue({ error: null });
      const mockLocationEqSession = jest.fn().mockReturnValue({ eq: mockLocationEqUser });
      const mockLocationDelete = jest.fn().mockReturnValue({ eq: mockLocationEqSession });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'location_session_participants') {
          return { update: mockParticipantUpdate };
        }
        if (table === 'current_locations') {
          return { delete: mockLocationDelete };
        }
        return {};
      });

      const result = await locationSessionService.leaveSession('sess_1', 'usr_member');

      expect(result.success).toBe(true);
      expect(mockParticipantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'LEFT',
        }),
      );
      expect(mockParticipantEqSession).toHaveBeenCalledWith('session_id', 'sess_1');
      expect(mockParticipantEqUser).toHaveBeenCalledWith('user_id', 'usr_member');
      expect(mockLocationDelete).toHaveBeenCalled();
    });
  });

  describe('endSession', () => {
    it('sets session status to ENDED and records ended_at', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
        delete: mockDelete,
      });

      const result = await locationSessionService.endSession('sess_1', 'usr_owner');

      expect(supabase.from).toHaveBeenCalledWith('location_sessions');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ENDED',
        }),
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'sess_1');
      expect(result.success).toBe(true);
    });
  });

  describe('getSessionParticipants', () => {
    it('returns formatted domain SessionParticipant records', async () => {
      const mockRows = [
        {
          id: 'part_1',
          session_id: 'sess_1',
          user_id: 'usr_1',
          status: 'ACTIVE',
          joined_at: '2026-09-23T10:00:00Z',
          left_at: null,
          user: {
            user_id: 'usr_1',
            display_name: 'Alice Member',
            username: 'alice',
            avatar_path: null,
          },
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockRows, error: null });
      const mockEqStatus = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEqSession = jest.fn().mockReturnValue({ eq: mockEqStatus });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEqSession });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await locationSessionService.getSessionParticipants('sess_1');

      expect(result.error).toBeUndefined();
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0]?.userId).toBe('usr_1');
      expect(result.participants[0]?.user?.displayName).toBe('Alice Member');
      expect(result.participants[0]?.status).toBe('ACTIVE');
    });
  });

  describe('getCurrentLocations', () => {
    it('returns list of CurrentLocation fixes', async () => {
      const mockLocationRows = [
        {
          session_id: 'sess_1',
          user_id: 'usr_1',
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 5.2,
          heading: 90,
          speed: 1.2,
          recorded_at: '2026-09-23T10:05:00Z',
          user: {
            user_id: 'usr_1',
            display_name: 'Alice Member',
            username: 'alice',
            avatar_path: null,
          },
        },
      ];

      const mockEq = jest.fn().mockResolvedValue({ data: mockLocationRows, error: null });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await locationSessionService.getCurrentLocations('sess_1');

      expect(result.error).toBeUndefined();
      expect(result.locations).toHaveLength(1);
      expect(result.locations[0]?.latitude).toBe(40.7128);
      expect(result.locations[0]?.longitude).toBe(-74.006);
      expect(result.locations[0]?.accuracy).toBe(5.2);
      expect(result.locations[0]?.user?.displayName).toBe('Alice Member');
    });
  });
});
