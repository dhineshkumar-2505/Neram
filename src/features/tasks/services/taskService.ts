import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database';
import type {
  TaskRecord,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  TaskPriority,
  TaskAssignee,
} from '../types';

export interface FetchTasksResult {
  tasks: TaskRecord[];
  error?: string;
}

export interface SingleTaskResult {
  task: TaskRecord | null;
  error?: string;
}

export interface TaskMutationResult {
  success: boolean;
  error?: string;
}

export interface EligibleAssigneesResult {
  members: TaskAssignee[];
  error?: string;
}

interface TaskJoinAssignee {
  user_id: string;
  profile?: {
    user_id?: string;
    display_name?: string | null;
    username?: string | null;
    avatar_path?: string | null;
  } | null;
}

interface TaskJoinRow {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string | null;
  position?: number | null;
  created_at: string;
  updated_at: string;
  creator?: {
    user_id: string;
    display_name?: string | null;
    username?: string | null;
  } | null;
  task_assignees?: TaskJoinAssignee[] | null;
}

/**
 * Transforms raw Supabase task join row into domain TaskRecord.
 */
function mapTaskRowToRecord(row: TaskJoinRow): TaskRecord {
  const assignees: TaskAssignee[] = [];
  if (Array.isArray(row.task_assignees)) {
    for (const a of row.task_assignees) {
      if (a && a.user_id) {
        assignees.push({
          userId: a.user_id,
          username: a.profile?.username || '',
          displayName: a.profile?.display_name || a.profile?.username || 'Member',
          avatarUrl: a.profile?.avatar_path || null,
        });
      }
    }
  }

  return {
    id: row.id,
    groupId: row.group_id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description || null,
    status: row.status,
    priority: row.priority,
    deadline: row.deadline || null,
    position: typeof row.position === 'number' ? row.position : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignees,
    creator: row.creator
      ? {
          userId: row.creator.user_id,
          displayName: row.creator.display_name || row.creator.username || 'Creator',
          username: row.creator.username || '',
        }
      : undefined,
  };
}

export const taskService = {
  /**
   * Fetches all tasks for a temporary group ordered by position and creation timestamp.
   */
  async fetchTasks(groupId: string): Promise<FetchTasksResult> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          group_id,
          creator_id,
          title,
          description,
          status,
          priority,
          deadline,
          position,
          created_at,
          updated_at,
          creator:profiles!tasks_creator_id_fkey(
            user_id,
            display_name,
            username
          ),
          task_assignees(
            user_id,
            profile:profiles(
              user_id,
              display_name,
              username,
              avatar_path
            )
          )
        `)
        .eq('group_id', groupId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        return { tasks: [], error: error.message };
      }

      const tasks = ((data || []) as unknown as TaskJoinRow[]).map(mapTaskRowToRecord);
      return { tasks };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tasks.';
      return { tasks: [], error: message };
    }
  },

  /**
   * Fetches a single task by ID.
   */
  async fetchTask(taskId: string): Promise<SingleTaskResult> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          group_id,
          creator_id,
          title,
          description,
          status,
          priority,
          deadline,
          position,
          created_at,
          updated_at,
          creator:profiles!tasks_creator_id_fkey(
            user_id,
            display_name,
            username
          ),
          task_assignees(
            user_id,
            profile:profiles(
              user_id,
              display_name,
              username,
              avatar_path
            )
          )
        `)
        .eq('id', taskId)
        .maybeSingle();

      if (error) {
        return { task: null, error: error.message };
      }
      if (!data) {
        return { task: null, error: 'Task not found.' };
      }

      return { task: mapTaskRowToRecord(data as unknown as TaskJoinRow) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch task.';
      return { task: null, error: message };
    }
  },

  /**
   * Creates a new collaborative task with optional multi-assignee assignment.
   */
  async createTask(
    creatorId: string,
    input: CreateTaskInput,
  ): Promise<SingleTaskResult> {
    try {
      const title = input.title?.trim();
      if (!title || title.length === 0) {
        return { task: null, error: 'Task title is required.' };
      }
      if (title.length > 120) {
        return { task: null, error: 'Task title must be 120 characters or less.' };
      }

      // Compute next position
      const { data: posData } = await supabase
        .from('tasks')
        .select('position')
        .eq('group_id', input.groupId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition =
        posData && posData.length > 0 && typeof posData[0]?.position === 'number'
          ? posData[0].position + 1
          : 0;

      // Insert task record
      const { data: insertedTask, error: insertError } = await supabase
        .from('tasks')
        .insert({
          group_id: input.groupId,
          creator_id: creatorId,
          title,
          description: input.description?.trim() || null,
          priority: input.priority || 'MEDIUM',
          status: 'NOT_STARTED',
          deadline: input.deadline || null,
          position: nextPosition,
        })
        .select('id')
        .single();

      if (insertError || !insertedTask) {
        return { task: null, error: insertError?.message || 'Failed to create task.' };
      }

      // Assign users if provided
      if (input.assigneeIds && input.assigneeIds.length > 0) {
        const uniqueAssignees = Array.from(new Set(input.assigneeIds));
        const assigneeRows = uniqueAssignees.map((uid) => ({
          task_id: insertedTask.id,
          user_id: uid,
        }));

        const { error: assignError } = await supabase
          .from('task_assignees')
          .insert(assigneeRows);

        if (assignError && __DEV__) {
          console.warn('[taskService] Failed to insert task assignees:', assignError.message);
        }
      }

      // Fetch and return the fully populated task
      return await this.fetchTask(insertedTask.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create task.';
      return { task: null, error: message };
    }
  },

  /**
   * Updates an existing task and synchronizes its assignees.
   */
  async updateTask(
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<SingleTaskResult> {
    try {
      const updatePayload: Database['public']['Tables']['tasks']['Update'] = {};

      if (input.title !== undefined) {
        const trimmed = input.title.trim();
        if (trimmed.length === 0 || trimmed.length > 120) {
          return { task: null, error: 'Task title must be between 1 and 120 characters.' };
        }
        updatePayload.title = trimmed;
      }
      if (input.description !== undefined) {
        updatePayload.description = input.description?.trim() || null;
      }
      if (input.status !== undefined) {
        updatePayload.status = input.status;
      }
      if (input.priority !== undefined) {
        updatePayload.priority = input.priority;
      }
      if (input.deadline !== undefined) {
        updatePayload.deadline = input.deadline;
      }
      if (input.position !== undefined) {
        updatePayload.position = input.position;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update(updatePayload)
          .eq('id', taskId);

        if (updateError) {
          return { task: null, error: updateError.message };
        }
      }

      // Update assignees if provided
      if (input.assigneeIds !== undefined) {
        // Delete previous assignees
        await supabase
          .from('task_assignees')
          .delete()
          .eq('task_id', taskId);

        if (input.assigneeIds.length > 0) {
          const uniqueAssignees = Array.from(new Set(input.assigneeIds));
          const rows = uniqueAssignees.map((uid) => ({
            task_id: taskId,
            user_id: uid,
          }));

          const { error: insertAssigneesError } = await supabase
            .from('task_assignees')
            .insert(rows);

          if (insertAssigneesError && __DEV__) {
            console.warn('[taskService] assignees update error:', insertAssigneesError.message);
          }
        }
      }

      return await this.fetchTask(taskId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task.';
      return { task: null, error: message };
    }
  },

  /**
   * Fast status update (e.g. checkmark toggle).
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
  ): Promise<TaskMutationResult> {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task status.';
      return { success: false, error: message };
    }
  },

  /**
   * Fast priority update.
   */
  async updateTaskPriority(
    taskId: string,
    priority: TaskPriority,
  ): Promise<TaskMutationResult> {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ priority })
        .eq('id', taskId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task priority.';
      return { success: false, error: message };
    }
  },

  /**
   * Updates task position for reordering.
   */
  async updateTaskPosition(
    taskId: string,
    position: number,
  ): Promise<TaskMutationResult> {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ position })
        .eq('id', taskId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task position.';
      return { success: false, error: message };
    }
  },

  /**
   * Deletes a task by ID.
   */
  async deleteTask(taskId: string): Promise<TaskMutationResult> {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete task.';
      return { success: false, error: message };
    }
  },

  /**
   * Fetches active group members eligible for task assignment.
   * Guarantees only active group members can ever be assigned to tasks (Engineering Law 6).
   */
  async fetchGroupEligibleAssignees(
    groupId: string,
  ): Promise<EligibleAssigneesResult> {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          user_id,
          profile:profiles(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('group_id', groupId);

      if (error) {
        return { members: [], error: error.message };
      }

      const members: TaskAssignee[] = [];
      for (const item of data || []) {
        if (item && item.user_id) {
          members.push({
            userId: item.user_id,
            username: item.profile?.username || '',
            displayName: item.profile?.display_name || item.profile?.username || 'Member',
            avatarUrl: item.profile?.avatar_path || null,
          });
        }
      }

      return { members };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch group assignees.';
      return { members: [], error: message };
    }
  },
};

export default taskService;
