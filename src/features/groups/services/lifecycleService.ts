import { supabase } from '../../../lib/supabase';
import { GroupLifecycleState } from '../types';

export interface LifecycleStateChangePayload {
  lifecycleState: GroupLifecycleState;
  expiresAt: string;
}

export interface LifecycleMetrics {
  transitioned_expiring: number;
  transitioned_expired: number;
  transitioned_archived: number;
  transitioned_purged: number;
  closed_location_sessions: number;
  executed_at: string;
}

/**
 * Client Lifecycle Synchronization Service.
 * Subscribes to Supabase Realtime WebSocket changes to immediately reflect
 * server-side lifecycle transitions (EXPIRING, EXPIRED) without polling.
 */
export const lifecycleService = {
  /**
   * Subscribes to Realtime updates for a specific group.
   * Returns an unsubscribe callback for cleanup.
   */
  subscribeToGroupLifecycle(
    groupId: string,
    onStateChange: (payload: LifecycleStateChangePayload) => void,
  ): () => void {
    const channelName = `group-lifecycle-${groupId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${groupId}`,
        },
        (payload) => {
          const newRow = payload.new as {
            lifecycle_state?: GroupLifecycleState;
            expires_at?: string;
          };

          if (newRow?.lifecycle_state && newRow?.expires_at) {
            onStateChange({
              lifecycleState: newRow.lifecycle_state,
              expiresAt: newRow.expires_at,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Invokes the server-side lifecycle state machine directly.
   * Used as a fail-safe trigger if the local client observes expiry ahead of the background worker.
   */
  async triggerLifecycleSync(): Promise<{ metrics: LifecycleMetrics | null; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('process_group_lifecycle_transitions');

      if (error) {
        return { metrics: null, error: error.message };
      }

      return { metrics: data as unknown as LifecycleMetrics };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lifecycle sync execution failed.';
      return { metrics: null, error: message };
    }
  },
};

export default lifecycleService;
