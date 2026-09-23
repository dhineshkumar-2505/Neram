export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata_json: Json
          resource_id: string
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata_json?: Json
          resource_id: string
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata_json?: Json
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      current_locations: {
        Row: {
          accuracy: number
          heading: number | null
          latitude: number
          longitude: number
          recorded_at: string
          session_id: string
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy: number
          heading?: number | null
          latitude: number
          longitude: number
          recorded_at?: string
          session_id: string
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number
          heading?: number | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          session_id?: string
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "current_locations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "location_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "current_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          creator_id: string | null
          description: string | null
          ends_at: string | null
          group_id: string
          id: string
          is_milestone: boolean
          latitude: number | null
          location_name: string | null
          longitude: number | null
          target_time: string
          title: string
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ends_at?: string | null
          group_id: string
          id?: string
          is_milestone?: boolean
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          target_time: string
          title: string
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ends_at?: string | null
          group_id?: string
          id?: string
          is_milestone?: boolean
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          target_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          filename: string
          group_id: string
          id: string
          mime_type: string
          owner_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          filename: string
          group_id: string
          id?: string
          mime_type: string
          owner_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          filename?: string
          group_id?: string
          id?: string
          mime_type?: string
          owner_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_high_id: string
          user_low_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_high_id: string
          user_low_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_high_id?: string
          user_low_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_high_id_fkey"
            columns: ["user_high_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_user_low_id_fkey"
            columns: ["user_low_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_features: {
        Row: {
          enabled_at: string
          enabled_by: string
          feature_key: string
          group_id: string
        }
        Insert: {
          enabled_at?: string
          enabled_by: string
          feature_key: string
          group_id: string
        }
        Update: {
          enabled_at?: string
          enabled_by?: string
          feature_key?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_features_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "group_features_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string
          id: string
          image_path: string | null
          lifecycle_state: Database["public"]["Enums"]["lifecycle_state"]
          name: string
          owner_id: string
          purpose: Database["public"]["Enums"]["group_purpose"]
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at: string
          id?: string
          image_path?: string | null
          lifecycle_state?: Database["public"]["Enums"]["lifecycle_state"]
          name: string
          owner_id: string
          purpose: Database["public"]["Enums"]["group_purpose"]
          starts_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          image_path?: string | null
          lifecycle_state?: Database["public"]["Enums"]["lifecycle_state"]
          name?: string
          owner_id?: string
          purpose?: Database["public"]["Enums"]["group_purpose"]
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      location_sessions: {
        Row: {
          destination_lat: number
          destination_lng: number
          ends_at: string
          group_id: string
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["location_session_status"]
          user_id: string
        }
        Insert: {
          destination_lat: number
          destination_lng: number
          ends_at: string
          group_id: string
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["location_session_status"]
          user_id: string
        }
        Update: {
          destination_lat?: number
          destination_lng?: number
          ends_at?: string
          group_id?: string
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["location_session_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          file_id: string
          id: string
          message_id: string
        }
        Insert: {
          file_id: string
          id?: string
          message_id: string
        }
        Update: {
          file_id?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          group_id: string
          id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          group_id: string
          id?: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          group_id?: string
          id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          group_id: string | null
          id: string
          payload_json: Json
          read_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          payload_json?: Json
          read_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          payload_json?: Json
          read_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: string
          option_text: string
          poll_id: string
          sort_order: number
          vote_count: number
        }
        Insert: {
          id?: string
          option_text: string
          poll_id: string
          sort_order?: number
          vote_count?: number
        }
        Update: {
          id?: string
          option_text?: string
          poll_id?: string
          sort_order?: number
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      polls: {
        Row: {
          closed_at: string | null
          created_at: string
          creator_id: string
          expires_at: string | null
          group_id: string
          id: string
          is_closed: boolean
          is_multiple_choice: boolean
          question: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          creator_id: string
          expires_at?: string | null
          group_id: string
          id?: string
          is_closed?: boolean
          is_multiple_choice?: boolean
          question: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          is_closed?: boolean
          is_multiple_choice?: boolean
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          dob: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          dob?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          dob?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          task_id: string
          user_id: string
        }
        Insert: {
          task_id: string
          user_id: string
        }
        Update: {
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          creator_id: string
          deadline: string | null
          description: string | null
          group_id: string
          id: string
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          deadline?: string | null
          description?: string | null
          group_id: string
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          deadline?: string | null
          description?: string | null
          group_id?: string
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_id: string
          last_seen_at: string
          platform: string
          push_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          last_seen_at?: string
          platform: string
          push_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          last_seen_at?: string
          platform?: string
          push_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      cast_poll_vote: {
        Args: { p_poll_id: string; p_option_id: string }
        Returns: Json
      }
      close_poll: {
        Args: { p_poll_id: string }
        Returns: Json
      }
      is_blocked: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      is_group_active: { Args: { p_group_id: string }; Returns: boolean }
      is_group_admin: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_group_feature_enabled: {
        Args: { p_feature: string; p_group_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      process_group_lifecycle_transitions: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      respond_to_friend_request: {
        Args: { p_accept: boolean; p_request_id: string }
        Returns: undefined
      }
      search_exact_username: {
        Args: { p_username: string }
        Returns: {
          avatar_path: string
          bio: string
          display_name: string
          user_id: string
          username: string
        }[]
      }
    }
    Enums: {
      friend_request_status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"
      group_purpose:
        | "OUTING"
        | "PROJECT"
        | "HACKATHON"
        | "BIRTHDAY"
        | "TRIP"
        | "STUDY"
        | "SPORTS"
        | "EVENT"
        | "CUSTOM"
      group_role: "OWNER" | "ADMIN" | "MEMBER"
      lifecycle_state:
        | "CREATED"
        | "ACTIVE"
        | "EXPIRING"
        | "EXPIRED"
        | "ARCHIVED"
        | "PURGED"
      location_session_status: "ACTIVE" | "PAUSED" | "ARRIVED" | "ENDED"
      notification_type:
        | "FRIEND_REQUEST"
        | "FRIEND_ACCEPTED"
        | "GROUP_INVITE"
        | "TASK_ASSIGNED"
        | "TASK_DEADLINE"
        | "MESSAGE_MENTION"
        | "EVENT_REMINDER"
        | "MEETING_APPROACHING"
        | "MEMBER_ARRIVED"
        | "GROUP_EXPIRING"
        | "GROUP_EXPIRED"
      task_priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      task_status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      friend_request_status: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"],
      group_purpose: [
        "OUTING",
        "PROJECT",
        "HACKATHON",
        "BIRTHDAY",
        "TRIP",
        "STUDY",
        "SPORTS",
        "EVENT",
        "CUSTOM",
      ],
      group_role: ["OWNER", "ADMIN", "MEMBER"],
      lifecycle_state: [
        "CREATED",
        "ACTIVE",
        "EXPIRING",
        "EXPIRED",
        "ARCHIVED",
        "PURGED",
      ],
      location_session_status: ["ACTIVE", "PAUSED", "ARRIVED", "ENDED"],
      notification_type: [
        "FRIEND_REQUEST",
        "FRIEND_ACCEPTED",
        "GROUP_INVITE",
        "TASK_ASSIGNED",
        "TASK_DEADLINE",
        "MESSAGE_MENTION",
        "EVENT_REMINDER",
        "MEETING_APPROACHING",
        "MEMBER_ARRIVED",
        "GROUP_EXPIRING",
        "GROUP_EXPIRED",
      ],
      task_priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      task_status: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"],
    },
  },
} as const
