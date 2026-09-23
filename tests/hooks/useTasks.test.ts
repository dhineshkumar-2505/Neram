import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTasks } from '../../src/features/tasks/hooks/useTasks';
import { taskService } from '../../src/features/tasks/services/taskService';
import { supabase } from '../../src/lib/supabase';
import type { TaskRecord } from '../../src/features/tasks/types';

jest.mock('../../src/features/tasks/services/taskService');
jest.mock('../../src/lib/supabase');

describe('useTasks hook', () => {
  const mockTasks: TaskRecord[] = [
    {
      id: 'task_1',
      groupId: 'grp_123',
      creatorId: 'user_1',
      title: 'Setup production database',
      description: 'Run migrations',
      status: 'NOT_STARTED',
      priority: 'CRITICAL',
      deadline: '2026-09-24T12:00:00Z',
      position: 0,
      createdAt: '2026-09-23T08:00:00Z',
      updatedAt: '2026-09-23T08:00:00Z',
      assignees: [
        {
          userId: 'user_alex',
          username: 'alex_d',
          displayName: 'Alex Rivers',
          avatarUrl: null,
        },
      ],
    },
    {
      id: 'task_2',
      groupId: 'grp_123',
      creatorId: 'user_1',
      title: 'Implement unit tests',
      description: null,
      status: 'COMPLETED',
      priority: 'LOW',
      deadline: null,
      position: 1,
      createdAt: '2026-09-23T09:00:00Z',
      updatedAt: '2026-09-23T09:00:00Z',
      assignees: [],
    },
  ];

  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (taskService.fetchTasks as jest.Mock).mockResolvedValue({
      tasks: mockTasks,
    });
    (taskService.fetchGroupEligibleAssignees as jest.Mock).mockResolvedValue({
      members: [
        {
          userId: 'user_alex',
          username: 'alex_d',
          displayName: 'Alex Rivers',
          avatarUrl: null,
        },
      ],
    });
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    (supabase.removeChannel as jest.Mock).mockReturnValue(Promise.resolve());
  });

  it('fetches tasks and eligible assignees on mount', async () => {
    const { result } = renderHook(() =>
      useTasks({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(taskService.fetchTasks).toHaveBeenCalledWith('grp_123');
    expect(taskService.fetchGroupEligibleAssignees).toHaveBeenCalledWith('grp_123');
    expect(result.current.allTasks).toHaveLength(2);
    expect(result.current.counts).toEqual({ total: 2, active: 1, completed: 1 });
    expect(result.current.eligibleAssignees).toHaveLength(1);
  });

  it('filters tasks by tab (ACTIVE / COMPLETED / ALL)', async () => {
    const { result } = renderHook(() =>
      useTasks({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Default ALL
    expect(result.current.tasks).toHaveLength(2);

    // Switch to ACTIVE
    act(() => {
      result.current.setFilterTab('ACTIVE');
    });
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]?.id).toBe('task_1');

    // Switch to COMPLETED
    act(() => {
      result.current.setFilterTab('COMPLETED');
    });
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]?.id).toBe('task_2');
  });

  it('filters tasks by selected assignee', async () => {
    const { result } = renderHook(() =>
      useTasks({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedAssigneeId('user_alex');
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]?.id).toBe('task_1');
  });

  it('optimistically updates task status and completes successfully', async () => {
    (taskService.updateTaskStatus as jest.Mock).mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useTasks({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { success: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.toggleTaskStatus('task_1');
    });

    expect(res?.success).toBe(true);
    expect(taskService.updateTaskStatus).toHaveBeenCalledWith('task_1', 'COMPLETED');
  });

  it('rolls back optimistic status toggle on backend failure', async () => {
    (taskService.updateTaskStatus as jest.Mock).mockResolvedValue({
      success: false,
      error: 'RLS check failed: Group expired',
    });

    const { result } = renderHook(() =>
      useTasks({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { success: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.toggleTaskStatus('task_1');
    });

    expect(res?.success).toBe(false);
    expect(result.current.error).toBe('RLS check failed: Group expired');
    // Reverted back to NOT_STARTED
    const reverted = result.current.allTasks.find((t) => t.id === 'task_1');
    expect(reverted?.status).toBe('NOT_STARTED');
  });

  it('blocks mutations when isExpired is true (read-only freeze)', async () => {
    const { result } = renderHook(() =>
      useTasks({ groupId: 'grp_123', isExpired: true, currentUserId: 'user_1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isReadOnly).toBe(true);

    const toggleRes = await result.current.toggleTaskStatus('task_1');
    expect(toggleRes.success).toBe(false);
    expect(toggleRes.error).toBe('Space expired. Task board is read-only.');

    const createRes = await result.current.createTask({ title: 'New item' });
    expect(createRes.task).toBeNull();
    expect(createRes.error).toBe('This temporary space has expired and is read-only.');

    const deleteRes = await result.current.deleteTask('task_1');
    expect(deleteRes.success).toBe(false);
  });

  it('unsubscribes and cleans up channel on unmount', async () => {
    const { unmount } = renderHook(() =>
      useTasks({ groupId: 'grp_123', currentUserId: 'user_1' }),
    );

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
