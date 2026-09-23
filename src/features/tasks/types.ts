import type { Database } from '../../types/database';

export type TaskStatus = Database['public']['Enums']['task_status'];
export type TaskPriority = Database['public']['Enums']['task_priority'];

export interface TaskAssignee {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TaskCreator {
  userId: string;
  username: string;
  displayName: string;
}

export interface TaskRecord {
  id: string;
  groupId: string;
  creatorId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
  creator?: TaskCreator;
}

export interface CreateTaskInput {
  groupId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  deadline?: string | null;
  assigneeIds?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string | null;
  position?: number;
  assigneeIds?: string[];
}

export type TaskFilterTab = 'ALL' | 'ACTIVE' | 'COMPLETED';

export type TaskSortOption = 'POSITION' | 'PRIORITY' | 'DEADLINE';
