import { taskService } from '../../src/features/tasks/services/taskService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('taskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTasks', () => {
    it('fetches tasks for a group and formats domain TaskRecord objects', async () => {
      const mockRawRows = [
        {
          id: 'task_1',
          group_id: 'grp_123',
          creator_id: 'user_creator',
          title: 'Design high-fidelity wireframes',
          description: 'Focus on Obsidian dark aesthetic',
          status: 'NOT_STARTED',
          priority: 'HIGH',
          deadline: '2026-09-24T18:00:00Z',
          position: 0,
          created_at: '2026-09-23T10:00:00Z',
          updated_at: '2026-09-23T10:00:00Z',
          creator: {
            user_id: 'user_creator',
            display_name: 'Lead Designer',
            username: 'lead_ui',
          },
          task_assignees: [
            {
              user_id: 'user_assignee_1',
              profile: {
                user_id: 'user_assignee_1',
                display_name: 'Alex Developer',
                username: 'alex_dev',
                avatar_path: 'https://example.com/avatar1.png',
              },
            },
          ],
        },
      ];

      const mockOrder2 = jest.fn().mockResolvedValue({ data: mockRawRows, error: null });
      const mockOrder1 = jest.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await taskService.fetchTasks('grp_123');

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockEq).toHaveBeenCalledWith('group_id', 'grp_123');
      expect(result.error).toBeUndefined();
      expect(result.tasks).toHaveLength(1);

      const task = result.tasks[0]!;
      expect(task.id).toBe('task_1');
      expect(task.title).toBe('Design high-fidelity wireframes');
      expect(task.priority).toBe('HIGH');
      expect(task.assignees).toHaveLength(1);
      expect(task.assignees[0]?.displayName).toBe('Alex Developer');
      expect(task.creator?.displayName).toBe('Lead Designer');
    });

    it('returns error when database query fails', async () => {
      const mockOrder2 = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failure' },
      });
      const mockOrder1 = jest.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await taskService.fetchTasks('grp_123');
      expect(result.tasks).toEqual([]);
      expect(result.error).toBe('Database connection failure');
    });
  });

  describe('createTask', () => {
    it('validates title is required and non-empty', async () => {
      const resultEmpty = await taskService.createTask('user_1', {
        groupId: 'grp_123',
        title: '   ',
      });
      expect(resultEmpty.task).toBeNull();
      expect(resultEmpty.error).toBe('Task title is required.');

      const resultTooLong = await taskService.createTask('user_1', {
        groupId: 'grp_123',
        title: 'A'.repeat(121),
      });
      expect(resultTooLong.task).toBeNull();
      expect(resultTooLong.error).toBe('Task title must be 120 characters or less.');
    });

    it('inserts task and assignees, computing next position', async () => {
      // 1. Mock select position
      const mockLimit = jest.fn().mockResolvedValue({ data: [{ position: 3 }] });
      const mockOrderPos = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEqPos = jest.fn().mockReturnValue({ order: mockOrderPos });

      // 2. Mock insert task
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'new_task_uuid' },
        error: null,
      });
      const mockSelectInsert = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsertTask = jest.fn().mockReturnValue({ select: mockSelectInsert });

      // 3. Mock insert assignees
      const mockInsertAssignees = jest.fn().mockResolvedValue({ error: null });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: (cols: string) => {
              if (cols === 'position') return { eq: mockEqPos };
              // Used in fetchTask
              return {
                eq: () => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: 'new_task_uuid',
                      group_id: 'grp_123',
                      creator_id: 'user_1',
                      title: 'Ship sprint features',
                      description: 'Milestone 1',
                      status: 'NOT_STARTED',
                      priority: 'CRITICAL',
                      deadline: null,
                      position: 4,
                      created_at: '2026-09-23T10:00:00Z',
                      updated_at: '2026-09-23T10:00:00Z',
                      creator: {
                        user_id: 'user_1',
                        display_name: 'Me',
                        username: 'me',
                      },
                      task_assignees: [
                        {
                          user_id: 'user_peer_1',
                          profile: {
                            user_id: 'user_peer_1',
                            display_name: 'Peer 1',
                            username: 'peer1',
                            avatar_path: null,
                          },
                        },
                      ],
                    },
                    error: null,
                  }),
                }),
              };
            },
            insert: mockInsertTask,
          };
        }
        if (table === 'task_assignees') {
          return {
            insert: mockInsertAssignees,
          };
        }
        return {};
      });

      const result = await taskService.createTask('user_1', {
        groupId: 'grp_123',
        title: 'Ship sprint features',
        description: 'Milestone 1',
        priority: 'CRITICAL',
        assigneeIds: ['user_peer_1'],
      });

      expect(mockInsertTask).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 'grp_123',
          creator_id: 'user_1',
          title: 'Ship sprint features',
          priority: 'CRITICAL',
          position: 4,
        }),
      );
      expect(mockInsertAssignees).toHaveBeenCalledWith([
        { task_id: 'new_task_uuid', user_id: 'user_peer_1' },
      ]);
      expect(result.task).toBeTruthy();
      expect(result.task?.id).toBe('new_task_uuid');
      expect(result.task?.position).toBe(4);
    });
  });

  describe('updateTaskStatus & deleteTask', () => {
    it('updates status and returns success', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

      const result = await taskService.updateTaskStatus('task_123', 'COMPLETED');
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'COMPLETED' });
      expect(mockEq).toHaveBeenCalledWith('id', 'task_123');
      expect(result.success).toBe(true);
    });

    it('deletes task by id', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const result = await taskService.deleteTask('task_123');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'task_123');
      expect(result.success).toBe(true);
    });
  });

  describe('fetchGroupEligibleAssignees', () => {
    it('returns only active members of the group', async () => {
      const mockMembers = [
        {
          user_id: 'member_1',
          profile: {
            user_id: 'member_1',
            display_name: 'Sam Designer',
            username: 'sam_d',
            avatar_path: null,
          },
        },
      ];

      const mockEq = jest.fn().mockResolvedValue({ data: mockMembers, error: null });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await taskService.fetchGroupEligibleAssignees('grp_123');
      expect(supabase.from).toHaveBeenCalledWith('group_members');
      expect(mockEq).toHaveBeenCalledWith('group_id', 'grp_123');
      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.displayName).toBe('Sam Designer');
    });
  });
});
