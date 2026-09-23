import { supabase } from '../../../lib/supabase';
import {
  CreateGroupInput,
  GroupRecord,
  GroupDetailedRecord,
  GroupRole,
  calculateExpiryDate,
} from '../types';

export interface CreateGroupResult {
  group: GroupRecord | null;
  error?: string;
}

export interface UserGroupSummary extends GroupRecord {
  member_count: number;
  is_owner: boolean;
}

/**
 * Temporary Group Engine & Lifecycle Service.
 * Manages database mutations and queries strictly adhering to PostgreSQL Migration 4 constraints.
 */
export const groupService = {
  /**
   * Validates and creates a new temporary group with automatic owner membership
   * and optional mutual-friend member invitations.
   */
  async createGroup(input: CreateGroupInput, ownerId: string): Promise<CreateGroupResult> {
    try {
      const trimmedName = input.name.trim();

      // Constraint: chk_group_name_length (1 to 80 chars)
      if (trimmedName.length < 1) {
        return { group: null, error: 'Space name is required (1 to 80 characters).' };
      }
      if (trimmedName.length > 80) {
        return { group: null, error: 'Space name cannot exceed 80 characters.' };
      }

      // Constraint: chk_group_desc_length (max 500 chars)
      const trimmedDesc = input.description ? input.description.trim() : null;
      if (trimmedDesc && trimmedDesc.length > 500) {
        return { group: null, error: 'Description cannot exceed 500 characters.' };
      }

      // Expiry Ordering: expires_at > starts_at
      const startsAt = input.startsAt || new Date();
      const expiresAt = calculateExpiryDate(startsAt, input.duration);

      if (expiresAt.getTime() <= startsAt.getTime()) {
        return { group: null, error: 'Expiration timestamp must be forward in time.' };
      }

      // 1. Insert Group into public.groups
      // Trigger trg_group_creation_defaults automatically adds owner as 'OWNER' in group_members
      // and initializes default group_features.
      const { data: createdGroup, error: groupInsertError } = await supabase
        .from('groups')
        .insert({
          name: trimmedName,
          description: trimmedDesc,
          purpose: input.purpose,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          owner_id: ownerId,
          lifecycle_state: 'ACTIVE',
        })
        .select('*')
        .single();

      if (groupInsertError || !createdGroup) {
        return {
          group: null,
          error: groupInsertError?.message || 'Failed to initialize temporary space.',
        };
      }

      // 2. Invite Initial Members (if specified)
      // Database trigger trg_enforce_friend_only_membership strictly enforces that each
      // invitee is an accepted mutual friend and not blocked.
      if (input.initialMemberIds && input.initialMemberIds.length > 0) {
        const uniqueMemberIds = Array.from(new Set(input.initialMemberIds)).filter(
          (id) => id !== ownerId,
        );

        if (uniqueMemberIds.length > 0) {
          const memberRows = uniqueMemberIds.map((userId) => ({
            group_id: createdGroup.id,
            user_id: userId,
            role: 'MEMBER' as const,
          }));

          const { error: membersError } = await supabase
            .from('group_members')
            .insert(memberRows);

          if (membersError) {
            // Log warning but return group so creator is not locked out
            console.warn(
              '[groupService] Warning: some invited members could not be added:',
              membersError.message,
            );
          }
        }
      }

      return { group: createdGroup as GroupRecord };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected group creation error.';
      return { group: null, error: message };
    }
  },

  /**
   * Fetches active groups where the user is an owner or active member.
   */
  async fetchUserGroups(userId: string): Promise<{ groups: UserGroupSummary[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          id,
          owner_id,
          name,
          description,
          image_path,
          purpose,
          starts_at,
          expires_at,
          lifecycle_state,
          created_at,
          updated_at,
          group_members!inner(user_id, left_at)
        `)
        .eq('group_members.user_id', userId)
        .is('group_members.left_at', null)
        .order('expires_at', { ascending: true });

      if (error) {
        return { groups: [], error: error.message };
      }

      const summaries: UserGroupSummary[] = (data || []).map((row) => ({
        id: row.id,
        owner_id: row.owner_id,
        name: row.name,
        description: row.description,
        image_path: row.image_path,
        purpose: row.purpose,
        starts_at: row.starts_at,
        expires_at: row.expires_at,
        lifecycle_state: row.lifecycle_state,
        created_at: row.created_at,
        updated_at: row.updated_at,
        member_count: 1,
        is_owner: row.owner_id === userId,
      }));

      return { groups: summaries };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch user spaces.';
      return { groups: [], error: message };
    }
  },

  /**
   * Fetches full group details by ID including active members, profiles, and enabled features.
   */
  async fetchGroupDetails(
    groupId: string,
    currentUserId?: string,
  ): Promise<{ group: GroupDetailedRecord | null; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          id,
          owner_id,
          name,
          description,
          image_path,
          purpose,
          starts_at,
          expires_at,
          lifecycle_state,
          created_at,
          updated_at,
          group_members(
            user_id,
            role,
            joined_at,
            left_at,
            profiles(
              user_id,
              username,
              display_name,
              avatar_path
            )
          ),
          group_features(
            feature_key,
            enabled_at
          )
        `)
        .eq('id', groupId)
        .single();

      if (error || !data) {
        return { group: null, error: error?.message || 'Space not found.' };
      }

      type RawMember = {
        user_id: string;
        role: string;
        joined_at: string;
        left_at: string | null;
        profiles: {
          user_id: string;
          username: string;
          display_name: string;
          avatar_path: string | null;
        } | null;
      };

      const rawMembers = (data.group_members as unknown as RawMember[]) || [];
      const activeMembers = rawMembers
        .filter((m) => !m.left_at)
        .map((m) => ({
          user_id: m.user_id,
          role: m.role as GroupRole,
          joined_at: m.joined_at,
          profile: m.profiles
            ? {
                user_id: m.profiles.user_id,
                username: m.profiles.username,
                display_name: m.profiles.display_name,
                avatar_path: m.profiles.avatar_path,
              }
            : null,
        }));

      const rawFeatures =
        (data.group_features as unknown as Array<{ feature_key: string; enabled_at: string }>) || [];

      let currentUserRole: GroupRole | null = null;
      if (currentUserId) {
        if (data.owner_id === currentUserId) {
          currentUserRole = 'OWNER';
        } else {
          const match = activeMembers.find((m) => m.user_id === currentUserId);
          if (match) currentUserRole = match.role;
        }
      }

      const detailedGroup: GroupDetailedRecord = {
        id: data.id,
        owner_id: data.owner_id,
        name: data.name,
        description: data.description,
        image_path: data.image_path,
        purpose: data.purpose,
        starts_at: data.starts_at,
        expires_at: data.expires_at,
        lifecycle_state: data.lifecycle_state,
        created_at: data.created_at,
        updated_at: data.updated_at,
        members: activeMembers,
        features: rawFeatures,
        currentUserRole,
      };

      return { group: detailedGroup };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch space details.';
      return { group: null, error: message };
    }
  },
};

