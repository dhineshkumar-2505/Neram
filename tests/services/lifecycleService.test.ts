import { lifecycleService } from '../../src/features/groups/services/lifecycleService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('lifecycleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribeToGroupLifecycle', () => {
    it('sets up Realtime subscription on groups table and cleans up channel', () => {
      let registeredHandler:
        | ((payload: { new?: Record<string, unknown> }) => void)
        | null = null;

      const mockChannel = {
        on: jest.fn().mockImplementation((_event, _filter, handler) => {
          registeredHandler = handler;
          return mockChannel;
        }),
        subscribe: jest.fn().mockReturnThis(),
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const onStateChange = jest.fn();
      const unsubscribe = lifecycleService.subscribeToGroupLifecycle('grp_abc_123', onStateChange);

      // Verify channel created with correct ID
      expect(supabase.channel).toHaveBeenCalledWith('group-lifecycle-grp_abc_123');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'groups',
          filter: 'id=eq.grp_abc_123',
        }),
        expect.any(Function),
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();

      // Simulate Realtime UPDATE event
      expect(registeredHandler).not.toBeNull();
      registeredHandler!({
        new: {
          id: 'grp_abc_123',
          lifecycle_state: 'EXPIRED',
          expires_at: '2026-09-23T12:00:00Z',
        },
      });

      expect(onStateChange).toHaveBeenCalledWith({
        lifecycleState: 'EXPIRED',
        expiresAt: '2026-09-23T12:00:00Z',
      });

      // Cleanup
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('ignores Realtime payloads missing lifecycle_state', () => {
      let registeredHandler:
        | ((payload: { new?: Record<string, unknown> }) => void)
        | null = null;

      const mockChannel = {
        on: jest.fn().mockImplementation((_event, _filter, handler) => {
          registeredHandler = handler;
          return mockChannel;
        }),
        subscribe: jest.fn().mockReturnThis(),
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const onStateChange = jest.fn();
      lifecycleService.subscribeToGroupLifecycle('grp_abc_123', onStateChange);

      registeredHandler!({
        new: {
          id: 'grp_abc_123',
          name: 'Updated Name Only',
        },
      });

      expect(onStateChange).not.toHaveBeenCalled();
    });
  });

  describe('triggerLifecycleSync', () => {
    it('successfully calls process_group_lifecycle_transitions RPC and returns metrics', async () => {
      const mockMetrics = {
        transitioned_expiring: 2,
        transitioned_expired: 1,
        transitioned_archived: 0,
        transitioned_purged: 0,
        closed_location_sessions: 1,
        executed_at: '2026-09-23T12:00:00Z',
      };

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockMetrics,
        error: null,
      });

      const res = await lifecycleService.triggerLifecycleSync();

      expect(supabase.rpc).toHaveBeenCalledWith('process_group_lifecycle_transitions');
      expect(res.error).toBeUndefined();
      expect(res.metrics).toEqual(mockMetrics);
    });

    it('returns error when RPC invocation fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Function execution timeout' },
      });

      const res = await lifecycleService.triggerLifecycleSync();

      expect(res.metrics).toBeNull();
      expect(res.error).toBe('Function execution timeout');
    });
  });
});
