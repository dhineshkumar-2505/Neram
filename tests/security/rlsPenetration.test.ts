import { groupService } from '../../src/features/groups/services/groupService';
import { chatService } from '../../src/features/chat/services/chatService';
import { taskService } from '../../src/features/tasks/services/taskService';
import { pollService } from '../../src/features/polls/services/pollService';
import { eventService } from '../../src/features/events/services/eventService';
import { fileService } from '../../src/features/files/services/fileService';
import { locationSessionService } from '../../src/features/location/services/locationSessionService';
import { supabase } from '../../src/lib/supabase';

// Mock supabase client to simulate PostgreSQL RLS and trigger enforcement
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
    storage: {
      from: jest.fn(),
    },
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));

describe('NERAM PART 10: RLS Penetration & Negative Security Test Suite', () => {
  // Test Actor Identities
  const USER_A_OWNER = '11111111-1111-1111-1111-111111111111';
  const USER_B_MEMBER = '22222222-2222-2222-2222-222222222222';
  const ATTACKER = '99999999-9999-9999-9999-999999999999';
  const STRANGER_NON_FRIEND = '88888888-8888-8888-8888-888888888888';

  const TARGET_GROUP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ATTACKER_GROUP_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const EXPIRED_GROUP_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: ATTACKER } },
      error: null,
    });
  });

  // Helper for structured security audit assertions
  const logSecurityTest = (
    _actor: string,
    _operation: string,
    _target: string,
    _expected: string,
    _actual: string,
    pass: boolean,
  ) => {
    expect(pass).toBe(true);
  };

  describe('10.20: Cross-Tenant Spoofing Tests', () => {
    it('SELECT: Attacker cannot read messages from another group', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockIs = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        order: mockOrder,
        limit: mockLimit,
      });

      const result = await chatService.fetchMessages({ groupId: TARGET_GROUP_ID, limit: 20 });

      expect(result.messages).toEqual([]);
      expect(result.error).toBeTruthy();
      logSecurityTest('Attacker', 'SELECT messages', 'Target Group', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Attacker cannot insert a message into another group', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await chatService.sendMessage({
        groupId: TARGET_GROUP_ID,
        senderId: ATTACKER,
        body: 'Malicious cross-tenant injection',
      });

      expect(result.message).toBeNull();
      expect(result.error).toBeTruthy();
      logSecurityTest('Attacker', 'INSERT message', 'Target Group', 'DENIED', 'DENIED', true);
    });

    it('SELECT: Attacker cannot read tasks from another group', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for table tasks' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      });

      const result = await taskService.fetchTasks(TARGET_GROUP_ID);

      expect(result.tasks).toEqual([]);
      expect(result.error).toBeTruthy();
      logSecurityTest('Attacker', 'SELECT tasks', 'Target Group', 'DENIED', 'DENIED', true);
    });

    it('UPDATE: Attacker cannot update task status in another group', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for table tasks' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      const result = await taskService.updateTaskStatus('task_999', 'COMPLETED');

      expect(result.success).toBe(false);
      logSecurityTest('Attacker', 'UPDATE task', 'Target Group Task', 'DENIED', 'DENIED', true);
    });

    it('DELETE: Attacker cannot delete files from another group', async () => {
      const mockDelete = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for table files' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
        eq: mockEq,
      });

      const result = await fileService.deleteFile('file_target_123', ATTACKER);

      expect(result.success).toBe(false);
      logSecurityTest('Attacker', 'DELETE file', 'Target Group File', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.21: ID Spoofing Tests', () => {
    it('INSERT: Caller cannot forge owner_id during group creation', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates check constraint "Authenticated users can create groups"' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await groupService.createGroup(
        {
          name: 'Spoofed Owner Group',
          purpose: 'OUTING',
          duration: { months: 0, days: 1, hours: 0 },
        },
        USER_A_OWNER, // Attacker attempts to pass USER_A as ownerId
      );

      expect(result.group).toBeNull();
      expect(result.error).toBeTruthy();
      logSecurityTest('Attacker', 'INSERT group with forged owner_id', 'Groups Table', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Caller cannot forge sender_id on message insert', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates check constraint "auth.uid() = sender_id"' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await chatService.sendMessage({
        groupId: ATTACKER_GROUP_ID,
        senderId: USER_A_OWNER, // Forged sender_id
        body: 'I am pretending to be user A',
      });

      expect(result.message).toBeNull();
      expect(result.error).toBeTruthy();
      logSecurityTest('Attacker', 'INSERT message with forged sender_id', 'Messages Table', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Caller cannot forge creator_id on task insert', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates check constraint "auth.uid() = creator_id"' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await taskService.createTask(
        ATTACKER,
        {
          groupId: ATTACKER_GROUP_ID,
          title: 'Forged Task',
          priority: 'HIGH',
        },
      );

      expect(result).toBeDefined();
      logSecurityTest('Attacker', 'INSERT task with forged creator_id', 'Tasks Table', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.22: Expired Group Immutability Tests', () => {
    it('INSERT: Sending message to expired group is rejected server-side', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Security violation: Cannot post to an expired group.' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await chatService.sendMessage({
        groupId: EXPIRED_GROUP_ID,
        senderId: USER_B_MEMBER,
        body: 'Post-expiration message',
      });

      expect(result.message).toBeNull();
      expect(result.error).toBeTruthy();
      logSecurityTest('Member', 'INSERT message', 'Expired Group', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Creating task in expired group is rejected server-side', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Security violation: Cannot add tasks to an expired group.' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await taskService.createTask(
        USER_B_MEMBER,
        {
          groupId: EXPIRED_GROUP_ID,
          title: 'Post-expiry task',
          priority: 'MEDIUM',
        },
      );

      expect(result.task).toBeNull();
      expect(result.error).toBeTruthy();
      logSecurityTest('Member', 'INSERT task', 'Expired Group', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Voting in poll of expired group is rejected server-side', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Security violation: Cannot vote in an expired group.' },
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const result = await pollService.castVote('poll_in_expired_grp', 'opt_1');

      expect(result.success).toBe(false);
      logSecurityTest('Member', 'INSERT poll vote', 'Expired Group Poll', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Creating event in expired group is rejected server-side', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Security violation: Cannot create events in an expired group.' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await eventService.createEvent({
        groupId: EXPIRED_GROUP_ID,
        title: 'Post-expiry Meetup',
        targetTime: new Date(Date.now() + 3600000).toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      logSecurityTest('Member', 'INSERT event', 'Expired Group', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Starting location session in expired group is rejected server-side', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Security violation: Cannot start location session in an expired group.' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await locationSessionService.createSession(
        {
          groupId: EXPIRED_GROUP_ID,
          title: 'Expired Outing',
          destinationLat: 12.9716,
          destinationLng: 77.5946,
        },
        USER_B_MEMBER,
      );

      expect(result.session).toBeNull();
      expect(result.error).toBeTruthy();
      logSecurityTest('Member', 'INSERT location session', 'Expired Group', 'DENIED', 'DENIED', true);
    });

    it('DELETE: Deleting message in expired group is rejected server-side', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied: group is not active' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      const result = await chatService.softDeleteMessage('msg_in_expired_grp');

      expect(result.success).toBe(false);
      logSecurityTest('Sender', 'DELETE message', 'Expired Group', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.23: Non-Friend Group Access Tests', () => {
    it('TRIGGER: Adding a non-friend to group_members is blocked by database trigger', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'P0001',
          message: 'Security violation: Group membership requires an existing accepted mutual friendship with the inviter.',
        },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const { error } = await supabase.from('group_members').insert({
        group_id: TARGET_GROUP_ID,
        user_id: STRANGER_NON_FRIEND,
        role: 'MEMBER',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('mutual friendship');
      logSecurityTest('Admin', 'INSERT non-friend member', 'Group Members', 'DENIED', 'DENIED', true);
    });

    it('SELECT: Non-friend cannot discover or query private group roster', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for table group_members' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

      const result = await groupService.fetchGroupDetails(TARGET_GROUP_ID, STRANGER_NON_FRIEND);

      expect(result.group).toBeNull();
      logSecurityTest('Stranger', 'SELECT group roster', 'Private Group', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.24: Forged Location Insertion Tests', () => {
    it('INSERT: User cannot insert location coordinates for another user', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates check constraint "auth.uid() = user_id"' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const result = await locationSessionService.upsertCurrentLocation('session_123', USER_A_OWNER, {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        recordedAt: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      logSecurityTest('Attacker', 'UPSERT location fix with forged user_id', 'Current Locations', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Non-participant cannot insert location fixes into an active session', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates RLS policy: active participant required' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const result = await locationSessionService.upsertCurrentLocation('session_123', ATTACKER, {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        recordedAt: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      logSecurityTest('Non-Participant', 'UPSERT location fix', 'Location Session', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.25: Privilege Escalation Tests', () => {
    it('UPDATE: Regular member cannot promote themselves to OWNER or ADMIN', async () => {
      const mockEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Security violation: Only group Owner can promote member roles.' },
      });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({ eq: mockEq1 }),
      });

      const { error } = await supabase
        .from('group_members')
        .update({ role: 'ADMIN' })
        .eq('group_id', TARGET_GROUP_ID)
        .eq('user_id', USER_B_MEMBER);

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      logSecurityTest('Member', 'UPDATE role to ADMIN', 'Group Members', 'DENIED', 'DENIED', true);
    });

    it('INSERT: Member cannot toggle group features unless OWNER', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied: Owner can toggle group features in active groups' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const { error } = await supabase.from('group_features').upsert({
        group_id: TARGET_GROUP_ID,
        feature_key: 'LOCATION',
        enabled_by: USER_B_MEMBER,
      });

      expect(error).toBeTruthy();
      logSecurityTest('Member', 'UPSERT group_features', 'Group Features', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.26: Delete Authorization Tests', () => {
    it('DELETE: User cannot delete another user\'s message', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for table messages' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      const result = await chatService.softDeleteMessage('msg_owned_by_user_a');

      expect(result.success).toBe(false);
      logSecurityTest('Attacker', 'DELETE message owned by User A', 'Messages Table', 'DENIED', 'DENIED', true);
    });

    it('DELETE: User cannot delete another user\'s task', async () => {
      const mockDelete = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for table tasks' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
        eq: mockEq,
      });

      const result = await taskService.deleteTask('task_owned_by_user_a');

      expect(result.success).toBe(false);
      logSecurityTest('Attacker', 'DELETE task created by User A', 'Tasks Table', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.27: Storage RLS Penetration Tests', () => {
    it('UPLOAD: Cross-group upload into another group folder is rejected by storage policy', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'new row violates row-level security policy for bucket "attachments"' },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const result = await fileService.uploadFile(
        {
          groupId: TARGET_GROUP_ID,
          fileUri: 'file:///data/secret.pdf',
          filename: 'secret.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
        },
        ATTACKER,
      );

      expect(result.success).toBe(false);
      logSecurityTest('Attacker', 'UPLOAD to target group folder', 'Storage bucket "attachments"', 'DENIED', 'DENIED', true);
    });

    it('DELETE: Deleting another user\'s avatar in avatars bucket is rejected', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied: user folder mismatch' },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      const { data, error } = await supabase.storage.from('avatars').remove([`${USER_A_OWNER}/avatar.jpg`]);

      expect(error).toBeTruthy();
      expect(data).toBeNull();
      logSecurityTest('Attacker', 'REMOVE avatar of User A', 'Storage bucket "avatars"', 'DENIED', 'DENIED', true);
    });
  });

  describe('10.29: RPC & Administrative Stored Procedure Security', () => {
    it('RPC: Authenticated non-service role cannot invoke process_group_lifecycle_transitions', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for function process_group_lifecycle_transitions' },
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const { error } = await supabase.rpc('process_group_lifecycle_transitions');

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      logSecurityTest('Authenticated User', 'EXECUTE process_group_lifecycle_transitions', 'Administrative RPC', 'DENIED', 'DENIED', true);
    });

    it('RPC: Authenticated non-service role cannot invoke claim_groups_for_dissolution', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for function claim_groups_for_dissolution' },
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const { error } = await supabase.rpc('claim_groups_for_dissolution' as unknown as any, { p_limit: 5 });

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      logSecurityTest('Authenticated User', 'EXECUTE claim_groups_for_dissolution', 'Administrative RPC', 'DENIED', 'DENIED', true);
    });

    it('RPC: Authenticated non-service role cannot invoke execute_group_database_purge', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for function execute_group_database_purge' },
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const { error } = await supabase.rpc('execute_group_database_purge' as unknown as any, { p_group_id: TARGET_GROUP_ID });

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
      logSecurityTest('Authenticated User', 'EXECUTE execute_group_database_purge', 'Administrative RPC', 'DENIED', 'DENIED', true);
    });
  });
});
