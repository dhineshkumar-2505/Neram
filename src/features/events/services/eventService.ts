import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database';
import type {
  EventRecord,
  CreateEventInput,
  UpdateEventInput,
  FetchEventsResult,
  SingleEventResult,
  EventMutationResult,
} from '../types';
import { validateEventCoordinates } from '../types';

interface RawEventRow {
  id: string;
  group_id: string;
  creator_id: string | null;
  title: string;
  description: string | null;
  target_time: string;
  ends_at: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_milestone: boolean;
  created_at: string;
  creator?: {
    user_id: string;
    display_name: string | null;
    username: string | null;
    avatar_path: string | null;
  } | null;
}

/**
 * Transforms raw Supabase event database row into authoritative domain EventRecord.
 */
function mapEventRowToRecord(row: RawEventRow): EventRecord {
  return {
    id: row.id,
    groupId: row.group_id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    targetTime: row.target_time,
    endsAt: row.ends_at,
    locationName: row.location_name,
    latitude: row.latitude,
    longitude: row.longitude,
    isMilestone: Boolean(row.is_milestone),
    createdAt: row.created_at,
    creator: row.creator
      ? {
          userId: row.creator.user_id,
          displayName: row.creator.display_name || row.creator.username || 'Member',
          username: row.creator.username || 'member',
          avatarUrl: row.creator.avatar_path,
        }
      : undefined,
    // Aliases
    startsAt: row.target_time,
    locationText: row.location_name,
  };
}

export const eventService = {
  /**
   * Fetches all events for a group chronologically (target_time ascending).
   */
  async fetchEvents(groupId: string, _currentUserId?: string): Promise<FetchEventsResult> {
    try {
      if (!groupId) {
        return { events: [], error: 'Group ID is required.' };
      }

      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          group_id,
          creator_id,
          title,
          description,
          target_time,
          ends_at,
          location_name,
          latitude,
          longitude,
          is_milestone,
          created_at,
          creator:profiles!events_creator_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('group_id', groupId)
        .order('target_time', { ascending: true });

      if (error) {
        return { events: [], error: error.message };
      }

      const rows = (data as unknown as RawEventRow[]) || [];
      const events = rows.map(mapEventRowToRecord);

      return { events };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch group events.';
      return { events: [], error: message };
    }
  },

  /**
   * Fetches a single event by ID with creator profile join.
   */
  async fetchEvent(eventId: string, _currentUserId?: string): Promise<SingleEventResult> {
    try {
      if (!eventId) {
        return { event: null, error: 'Event ID is required.' };
      }

      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          group_id,
          creator_id,
          title,
          description,
          target_time,
          ends_at,
          location_name,
          latitude,
          longitude,
          is_milestone,
          created_at,
          creator:profiles!events_creator_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('id', eventId)
        .single();

      if (error) {
        return { event: null, error: error.message };
      }

      const event = mapEventRowToRecord(data as unknown as RawEventRow);
      return { event };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch event.';
      return { event: null, error: message };
    }
  },

  /**
   * Creates a new event or milestone in an active group.
   */
  async createEvent(input: CreateEventInput, currentUserId?: string): Promise<EventMutationResult> {
    try {
      const trimmedTitle = input.title?.trim();
      if (!trimmedTitle || trimmedTitle.length === 0) {
        return { success: false, error: 'Event title is required.' };
      }
      if (trimmedTitle.length > 100) {
        return { success: false, error: 'Event title must not exceed 100 characters.' };
      }

      if (!input.targetTime || isNaN(new Date(input.targetTime).getTime())) {
        return { success: false, error: 'Valid target date and time is required.' };
      }

      const coordCheck = validateEventCoordinates(input.latitude, input.longitude);
      if (!coordCheck.valid) {
        return { success: false, error: coordCheck.error || 'Invalid geographic coordinates.' };
      }

      // Check end time validity if provided
      if (input.endsAt) {
        const startMs = new Date(input.targetTime).getTime();
        const endMs = new Date(input.endsAt).getTime();
        if (isNaN(endMs) || endMs < startMs) {
          return { success: false, error: 'End time must be after target start time.' };
        }
      }

      const insertPayload = {
        group_id: input.groupId,
        title: trimmedTitle,
        description: input.description?.trim() || null,
        target_time: new Date(input.targetTime).toISOString(),
        ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
        location_name: input.locationName?.trim() || null,
        latitude: input.latitude !== undefined && input.latitude !== null ? input.latitude : null,
        longitude: input.longitude !== undefined && input.longitude !== null ? input.longitude : null,
        is_milestone: Boolean(input.isMilestone),
        creator_id: currentUserId || null,
      };

      const { data, error } = await supabase
        .from('events')
        .insert(insertPayload)
        .select(`
          id,
          group_id,
          creator_id,
          title,
          description,
          target_time,
          ends_at,
          location_name,
          latitude,
          longitude,
          is_milestone,
          created_at
        `)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const event = mapEventRowToRecord(data as unknown as RawEventRow);
      return { success: true, event };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create event.';
      return { success: false, error: message };
    }
  },

  /**
   * Updates an existing event's details, target time, location, or milestone status.
   */
  async updateEvent(eventId: string, input: UpdateEventInput): Promise<EventMutationResult> {
    try {
      if (!eventId) {
        return { success: false, error: 'Event ID is required.' };
      }

      const updatePayload: Database['public']['Tables']['events']['Update'] = {};

      if (input.title !== undefined) {
        const trimmedTitle = input.title.trim();
        if (!trimmedTitle || trimmedTitle.length === 0) {
          return { success: false, error: 'Event title cannot be empty.' };
        }
        if (trimmedTitle.length > 100) {
          return { success: false, error: 'Event title must not exceed 100 characters.' };
        }
        updatePayload.title = trimmedTitle;
      }

      if (input.description !== undefined) {
        updatePayload.description = input.description?.trim() || null;
      }

      if (input.targetTime !== undefined) {
        if (!input.targetTime || isNaN(new Date(input.targetTime).getTime())) {
          return { success: false, error: 'Valid target date and time is required.' };
        }
        updatePayload.target_time = new Date(input.targetTime).toISOString();
      }

      if (input.endsAt !== undefined) {
        if (input.endsAt === null) {
          updatePayload.ends_at = null;
        } else {
          const endMs = new Date(input.endsAt).getTime();
          if (isNaN(endMs)) {
            return { success: false, error: 'Invalid end date and time.' };
          }
          updatePayload.ends_at = new Date(input.endsAt).toISOString();
        }
      }

      if (input.locationName !== undefined) {
        updatePayload.location_name = input.locationName?.trim() || null;
      }

      if (input.latitude !== undefined || input.longitude !== undefined) {
        const lat = input.latitude !== undefined ? input.latitude : null;
        const lng = input.longitude !== undefined ? input.longitude : null;
        const coordCheck = validateEventCoordinates(lat, lng);
        if (!coordCheck.valid) {
          return { success: false, error: coordCheck.error || 'Invalid geographic coordinates.' };
        }
        updatePayload.latitude = lat;
        updatePayload.longitude = lng;
      }

      if (input.isMilestone !== undefined) {
        updatePayload.is_milestone = Boolean(input.isMilestone);
      }

      if (Object.keys(updatePayload).length === 0) {
        return { success: true };
      }

      const { data, error } = await supabase
        .from('events')
        .update(updatePayload)
        .eq('id', eventId)
        .select(`
          id,
          group_id,
          creator_id,
          title,
          description,
          target_time,
          ends_at,
          location_name,
          latitude,
          longitude,
          is_milestone,
          created_at
        `)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const event = mapEventRowToRecord(data as unknown as RawEventRow);
      return { success: true, event };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update event.';
      return { success: false, error: message };
    }
  },

  /**
   * Deletes an event (creator or group admin only in active groups).
   */
  async deleteEvent(eventId: string): Promise<EventMutationResult> {
    try {
      if (!eventId) {
        return { success: false, error: 'Event ID is required.' };
      }

      const { error } = await supabase.from('events').delete().eq('id', eventId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete event.';
      return { success: false, error: message };
    }
  },
};
