import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { taskService } from '../services/taskService';
import type {
  TaskRecord,
  TaskFilterTab,
  TaskSortOption,
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  UpdateTaskInput,
  TaskAssignee,
} from '../types';

export interface UseTasksOptions {
  groupId: string;
  isExpired?: boolean;
  currentUserId?: string;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function useTasks({
  groupId,
  isExpired = false,
  currentUserId,
}: UseTasksOptions) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [eligibleAssignees, setEligibleAssignees] = useState<TaskAssignee[]>([]);
  const [filterTab, setFilterTab] = useState<TaskFilterTab>('ALL');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<TaskSortOption>('POSITION');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);

  // Load initial tasks and eligible assignees
  const loadData = useCallback(async () => {
    if (!groupId) return;
    setError(null);

    const [tasksRes, assigneesRes] = await Promise.all([
      taskService.fetchTasks(groupId),
      taskService.fetchGroupEligibleAssignees(groupId),
    ]);

    if (!isMountedRef.current) return;

    if (tasksRes.error) {
      setError(tasksRes.error);
    } else {
      setTasks(tasksRes.tasks);
    }

    if (!assigneesRes.error) {
      setEligibleAssignees(assigneesRes.members);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [groupId]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    loadData();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadData]);

  // Pull-to-refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
  }, [loadData]);

  // Realtime subscription on group-tasks-{groupId}
  useEffect(() => {
    if (!groupId) return;

    const channelName = `group-tasks-${groupId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTaskId = (payload.new as { id: string })?.id;
            if (newTaskId) {
              const res = await taskService.fetchTask(newTaskId);
              if (res.task && isMountedRef.current) {
                setTasks((prev) => {
                  if (prev.some((t) => t.id === res.task?.id)) return prev;
                  return [...prev, res.task!];
                });
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTaskId = (payload.new as { id: string })?.id;
            if (updatedTaskId) {
              const res = await taskService.fetchTask(updatedTaskId);
              if (res.task && isMountedRef.current) {
                setTasks((prev) =>
                  prev.map((t) => (t.id === res.task?.id ? res.task! : t)),
                );
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedTaskId = (payload.old as { id: string })?.id;
            if (deletedTaskId && isMountedRef.current) {
              setTasks((prev) => prev.filter((t) => t.id !== deletedTaskId));
            }
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignees',
        },
        async (payload) => {
          // When assignees change, refresh the affected task
          const affectedTaskId =
            (payload.new as { task_id?: string })?.task_id ||
            (payload.old as { task_id?: string })?.task_id;

          if (affectedTaskId) {
            const res = await taskService.fetchTask(affectedTaskId);
            if (res.task && isMountedRef.current) {
              setTasks((prev) =>
                prev.map((t) => (t.id === res.task?.id ? res.task! : t)),
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  // Create Task
  const createTask = useCallback(
    async (
      input: Omit<CreateTaskInput, 'groupId'>,
    ): Promise<{ task: TaskRecord | null; error?: string }> => {
      if (isExpired) {
        return { task: null, error: 'This temporary space has expired and is read-only.' };
      }
      if (!currentUserId) {
        return { task: null, error: 'User must be authenticated to create a task.' };
      }

      const res = await taskService.createTask(currentUserId, {
        ...input,
        groupId,
      });

      if (res.task && isMountedRef.current) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === res.task?.id)) return prev;
          return [...prev, res.task!];
        });
      }

      return res;
    },
    [groupId, isExpired, currentUserId],
  );

  // Update Task
  const updateTask = useCallback(
    async (
      taskId: string,
      input: UpdateTaskInput,
    ): Promise<{ task: TaskRecord | null; error?: string }> => {
      if (isExpired) {
        return { task: null, error: 'This temporary space has expired and is read-only.' };
      }

      const res = await taskService.updateTask(taskId, input);
      if (res.task && isMountedRef.current) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? res.task! : t)),
        );
      }
      return res;
    },
    [isExpired],
  );

  // Optimistic Status Toggle (Checkmark completion)
  const toggleTaskStatus = useCallback(
    async (taskId: string): Promise<{ success: boolean; error?: string }> => {
      if (isExpired) {
        return { success: false, error: 'Space expired. Task board is read-only.' };
      }

      const target = tasks.find((t) => t.id === taskId);
      if (!target) return { success: false, error: 'Task not found.' };

      const nextStatus: TaskStatus =
        target.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED';

      // Optimistic state transition
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
      );

      const res = await taskService.updateTaskStatus(taskId, nextStatus);

      if (!res.success) {
        // Rollback on failure
        if (isMountedRef.current) {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: target.status } : t)),
          );
          setError(res.error || 'Failed to update task status.');
        }
        return res;
      }

      return { success: true };
    },
    [tasks, isExpired],
  );

  // Delete Task
  const deleteTask = useCallback(
    async (taskId: string): Promise<{ success: boolean; error?: string }> => {
      if (isExpired) {
        return { success: false, error: 'Space expired. Task board is read-only.' };
      }

      const originalTasks = tasks;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      const res = await taskService.deleteTask(taskId);

      if (!res.success) {
        // Rollback
        if (isMountedRef.current) {
          setTasks(originalTasks);
          setError(res.error || 'Failed to delete task.');
        }
        return res;
      }

      return { success: true };
    },
    [tasks, isExpired],
  );

  // Filtered and Sorted task list
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by Tab
    if (filterTab === 'ACTIVE') {
      result = result.filter((t) => t.status !== 'COMPLETED');
    } else if (filterTab === 'COMPLETED') {
      result = result.filter((t) => t.status === 'COMPLETED');
    }

    // Filter by Assignee
    if (selectedAssigneeId) {
      result = result.filter((t) =>
        t.assignees.some((a) => a.userId === selectedAssigneeId),
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'PRIORITY') {
        const pDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (pDiff !== 0) return pDiff;
      } else if (sortBy === 'DEADLINE') {
        if (a.deadline && b.deadline) {
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        if (a.deadline && !b.deadline) return -1;
        if (!a.deadline && b.deadline) return 1;
      }

      // Default / fallback: position then created_at
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return result;
  }, [tasks, filterTab, selectedAssigneeId, sortBy]);

  // Counts
  const counts = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const active = total - completed;
    return { total, active, completed };
  }, [tasks]);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    counts,
    eligibleAssignees,
    filterTab,
    setFilterTab,
    selectedAssigneeId,
    setSelectedAssigneeId,
    sortBy,
    setSortBy,
    isLoading,
    isRefreshing,
    error,
    refresh,
    createTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    isReadOnly: isExpired,
  };
}

export default useTasks;
