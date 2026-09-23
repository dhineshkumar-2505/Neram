import { supabase } from '../../../lib/supabase';
import type {
  LocationSession,
  LocationSessionStatus,
  SessionParticipant,
  CurrentLocation,
  CreateSessionInput,
  LocationSessionResult,
  SessionParticipantsResult,
  CurrentLocationsResult,
  ParticipantStatus,
} from '../types';

interface RawProfile {
  user_id: string;
  display_name: string;
  username: string;
  avatar_path?: string | null;
}

interface RawSessionRow {
  id: string;
  group_id: string;
  created_by?: string | null;
  user_id: string;
  title: string;
  destination_name?: string | null;
  destination_lat: number;
  destination_lng: number;
  status: LocationSessionStatus;
  starts_at: string;
  ends_at: string;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
  creator?: RawProfile | null;
}

interface RawParticipantRow {
  id: string;
  session_id: string;
  user_id: string;
  status: string;
  joined_at: string;
  left_at?: string | null;
  user?: RawProfile | null;
}

interface RawLocationRow {
  session_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  recorded_at: string;
  user?: RawProfile | null;
}

function mapSessionRow(row: RawSessionRow): LocationSession {
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by || row.user_id,
    title: row.title || 'Group Outing',
    destinationName: row.destination_name || null,
    destinationLat: Number(row.destination_lat),
    destinationLng: Number(row.destination_lng),
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    endedAt: row.ended_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creator: row.creator
      ? {
          userId: row.creator.user_id,
          displayName: row.creator.display_name,
          username: row.creator.username,
          avatarPath: row.creator.avatar_path || null,
        }
      : undefined,
  };
}

export const locationSessionService = {
  /**
   * Retrieves the current active location-sharing session for a temporary space.
   */
  async getActiveSession(
    groupId: string,
    currentUserId?: string,
  ): Promise<LocationSessionResult> {
    try {
      if (!groupId) {
        return { session: null, error: 'Group ID is required.' };
      }

      const { data, error } = await supabase
        .from('location_sessions')
        .select(`
          id,
          group_id,
          created_by,
          user_id,
          title,
          destination_name,
          destination_lat,
          destination_lng,
          status,
          starts_at,
          ends_at,
          ended_at,
          created_at,
          updated_at,
          creator:profiles!location_sessions_user_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('group_id', groupId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return { session: null, error: error.message };
      }

      if (!data) {
        return { session: null };
      }

      const session = mapSessionRow(data as unknown as RawSessionRow);

      // Query participants count and check if current user is participating
      const { data: participants, error: partError } = await supabase
        .from('location_session_participants')
        .select('user_id, status')
        .eq('session_id', session.id)
        .eq('status', 'ACTIVE');

      if (!partError && participants) {
        session.participantsCount = participants.length;
        if (currentUserId) {
          session.isCurrentUserParticipant = participants.some(
            (p: { user_id: string }) => p.user_id === currentUserId,
          );
        }
      }

      return { session };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query active session.';
      return { session: null, error: message };
    }
  },

  /**
   * Starts a new outing rendezvous location session in an active group.
   */
  async createSession(
    input: CreateSessionInput,
    currentUserId: string,
  ): Promise<LocationSessionResult> {
    try {
      if (!currentUserId) {
        return { session: null, error: 'Authentication required to start a location session.' };
      }

      if (!input.groupId) {
        return { session: null, error: 'Group ID is required.' };
      }

      if (
        input.destinationLat === undefined ||
        input.destinationLat < -90 ||
        input.destinationLat > 90
      ) {
        return { session: null, error: 'Valid destination latitude (-90 to 90) is required.' };
      }

      if (
        input.destinationLng === undefined ||
        input.destinationLng < -180 ||
        input.destinationLng > 180
      ) {
        return { session: null, error: 'Valid destination longitude (-180 to 180) is required.' };
      }

      const durationMinutes = Math.min(Math.max(input.durationMinutes || 120, 15), 1440); // 15 mins to 24 hrs
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

      const { data, error } = await supabase
        .from('location_sessions')
        .insert({
          group_id: input.groupId,
          user_id: currentUserId,
          created_by: currentUserId,
          title: input.title?.trim() || 'Group Outing',
          destination_name: input.destinationName?.trim() || null,
          destination_lat: input.destinationLat,
          destination_lng: input.destinationLng,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: 'ACTIVE',
        })
        .select(`
          id,
          group_id,
          created_by,
          user_id,
          title,
          destination_name,
          destination_lat,
          destination_lng,
          status,
          starts_at,
          ends_at,
          ended_at,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        return { session: null, error: error.message };
      }

      const session = mapSessionRow(data as unknown as RawSessionRow);

      // Auto-enroll creator as the first active participant
      const { error: partError } = await supabase
        .from('location_session_participants')
        .insert({
          session_id: session.id,
          user_id: currentUserId,
          status: 'ACTIVE',
        });

      if (partError) {
        // Rollback session creation if participant auto-join fails
        await supabase.from('location_sessions').delete().eq('id', session.id);
        return { session: null, error: partError.message };
      }

      session.participantsCount = 1;
      session.isCurrentUserParticipant = true;

      return { session };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create location session.';
      return { session: null, error: message };
    }
  },

  /**
   * Explicitly joins an active location session to share live position.
   */
  async joinSession(
    sessionId: string,
    currentUserId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!currentUserId) {
        return { success: false, error: 'Authentication required to join location session.' };
      }

      if (!sessionId) {
        return { success: false, error: 'Session ID is required.' };
      }

      const { error } = await supabase
        .from('location_session_participants')
        .upsert(
          {
            session_id: sessionId,
            user_id: currentUserId,
            status: 'ACTIVE',
            joined_at: new Date().toISOString(),
            left_at: null,
          },
          { onConflict: 'session_id,user_id' },
        );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join location session.';
      return { success: false, error: message };
    }
  },

  /**
   * Leaves location sharing.
   * Marks participant as 'LEFT' and automatically purges their current_locations fix.
   */
  async leaveSession(
    sessionId: string,
    currentUserId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!currentUserId || !sessionId) {
        return { success: false, error: 'Session ID and User ID are required.' };
      }

      const { error } = await supabase
        .from('location_session_participants')
        .update({
          status: 'LEFT',
          left_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId)
        .eq('user_id', currentUserId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Explicitly delete fix as backup in case trigger is deferred
      await supabase
        .from('current_locations')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', currentUserId);

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to leave location session.';
      return { success: false, error: message };
    }
  },

  /**
   * Ends an active location session.
   * Marks session 'ENDED' and automatically purges all active fixes.
   */
  async endSession(
    sessionId: string,
    currentUserId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!currentUserId || !sessionId) {
        return { success: false, error: 'Session ID and User ID are required.' };
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('location_sessions')
        .update({
          status: 'ENDED',
          ended_at: now,
          updated_at: now,
        })
        .eq('id', sessionId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Explicitly purge fixes as backup in case trigger is deferred
      await supabase.from('current_locations').delete().eq('session_id', sessionId);

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to end location session.';
      return { success: false, error: message };
    }
  },

  /**
   * Fetches all active participants for a given location session.
   */
  async getSessionParticipants(sessionId: string): Promise<SessionParticipantsResult> {
    try {
      if (!sessionId) {
        return { participants: [], error: 'Session ID is required.' };
      }

      const { data, error } = await supabase
        .from('location_session_participants')
        .select(`
          id,
          session_id,
          user_id,
          status,
          joined_at,
          left_at,
          user:profiles!location_session_participants_user_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('session_id', sessionId)
        .eq('status', 'ACTIVE')
        .order('joined_at', { ascending: true });

      if (error) {
        return { participants: [], error: error.message };
      }

      const rawRows = (data as unknown as RawParticipantRow[]) || [];
      const participants: SessionParticipant[] = rawRows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id,
        status: (row.status as ParticipantStatus) || 'ACTIVE',
        joinedAt: row.joined_at,
        leftAt: row.left_at || null,
        user: row.user
          ? {
              userId: row.user.user_id,
              displayName: row.user.display_name,
              username: row.user.username,
              avatarPath: row.user.avatar_path || null,
            }
          : undefined,
      }));

      return { participants };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve participants.';
      return { participants: [], error: message };
    }
  },

  /**
   * Fetches current ephemeral location fixes for an active session.
   */
  async getCurrentLocations(sessionId: string): Promise<CurrentLocationsResult> {
    try {
      if (!sessionId) {
        return { locations: [], error: 'Session ID is required.' };
      }

      const { data, error } = await supabase
        .from('current_locations')
        .select(`
          session_id,
          user_id,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          recorded_at,
          user:profiles!current_locations_user_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('session_id', sessionId);

      if (error) {
        return { locations: [], error: error.message };
      }

      const rawRows = (data as unknown as RawLocationRow[]) || [];
      const locations: CurrentLocation[] = rawRows.map((row) => ({
        sessionId: row.session_id,
        userId: row.user_id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        accuracy: Number(row.accuracy),
        speed: row.speed ? Number(row.speed) : null,
        heading: row.heading ? Number(row.heading) : null,
        recordedAt: row.recorded_at,
        user: row.user
          ? {
              userId: row.user.user_id,
              displayName: row.user.display_name,
              username: row.user.username,
              avatarPath: row.user.avatar_path || null,
            }
          : undefined,
      }));

      return { locations };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve locations.';
      return { locations: [], error: message };
    }
  },

  /**
   * Upserts the user's latest ephemeral coordinates to current_locations.
   * Enforces server RLS policies requiring an active session and active participation.
   */
  async upsertCurrentLocation(
    sessionId: string,
    userId: string,
    fix: {
      latitude: number;
      longitude: number;
      accuracy: number;
      speed?: number | null;
      heading?: number | null;
      recordedAt: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!sessionId || !userId) {
        return { success: false, error: 'Session ID and User ID are required.' };
      }

      const { error } = await supabase.from('current_locations').upsert(
        {
          session_id: sessionId,
          user_id: userId,
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          speed: fix.speed ?? null,
          heading: fix.heading ?? null,
          recorded_at: fix.recordedAt,
        },
        { onConflict: 'session_id,user_id' },
      );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update current location.';
      return { success: false, error: message };
    }
  },
};
