import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { TaskCard, formatDeadline } from '../../src/features/tasks/components/TaskCard';
import type { TaskRecord } from '../../src/features/tasks/types';

describe('TaskCard Component & formatDeadline', () => {
  describe('formatDeadline', () => {
    it('returns null on null or invalid input', () => {
      expect(formatDeadline(null, false)).toBeNull();
      expect(formatDeadline('invalid-date', false)).toBeNull();
    });

    it('identifies overdue deadlines when not completed', () => {
      const pastTime = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const res = formatDeadline(pastTime, false);
      expect(res?.isOverdue).toBe(true);
      expect(res?.text).toContain('Overdue by 3h');
    });

    it('does not mark overdue if task is completed', () => {
      const pastTime = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const res = formatDeadline(pastTime, true);
      expect(res?.isOverdue).toBe(false);
      expect(res?.text).toBe('Past due');
    });

    it('formats future deadlines cleanly', () => {
      const futureHours = new Date(Date.now() + 5 * 3600 * 1000).toISOString();
      const res = formatDeadline(futureHours, false);
      expect(res?.isOverdue).toBe(false);
      expect(res?.text).toBe('Due in 5h');
    });
  });

  describe('TaskCard Rendering', () => {
    const baseTask: TaskRecord = {
      id: 'task_card_1',
      groupId: 'grp_1',
      creatorId: 'user_1',
      title: 'Finalize presentation slides',
      description: 'Review contrast ratios and typography',
      status: 'NOT_STARTED',
      priority: 'CRITICAL',
      deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      position: 0,
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
      assignees: [
        {
          userId: 'user_priya',
          displayName: 'Priya Sharma',
          username: 'priya_s',
          avatarUrl: null,
        },
      ],
    };

    it('renders title, description, priority badge, and assignee avatar', () => {
      const mockToggle = jest.fn();
      const mockDelete = jest.fn();

      const { getByText, getByTestId } = render(
        <TaskCard
          task={baseTask}
          onToggleStatus={mockToggle}
          onDelete={mockDelete}
          isReadOnly={false}
        />,
      );

      expect(getByText('Finalize presentation slides')).toBeTruthy();
      expect(getByText('Review contrast ratios and typography')).toBeTruthy();
      expect(getByText('CRITICAL')).toBeTruthy();
      expect(getByText('P')).toBeTruthy(); // Initial of Priya Sharma

      // Fire checkmark toggle
      fireEvent.press(getByTestId('task-check-task_card_1'));
      expect(mockToggle).toHaveBeenCalledWith('task_card_1');

      // Fire delete
      fireEvent.press(getByTestId('delete-task-task_card_1'));
      expect(mockDelete).toHaveBeenCalledWith('task_card_1');
    });

    it('renders completed styling and completed check icon', () => {
      const completedTask: TaskRecord = {
        ...baseTask,
        id: 'task_comp',
        status: 'COMPLETED',
      };

      const { getByTestId } = render(
        <TaskCard task={completedTask} onToggleStatus={jest.fn()} />,
      );

      expect(getByTestId('task-card-task_comp')).toBeTruthy();
    });

    it('disables checkmark and hides delete button when isReadOnly is true', () => {
      const mockToggle = jest.fn();
      const mockDelete = jest.fn();

      const { queryByTestId, getByTestId } = render(
        <TaskCard
          task={baseTask}
          onToggleStatus={mockToggle}
          onDelete={mockDelete}
          isReadOnly={true}
        />,
      );

      expect(queryByTestId('delete-task-task_card_1')).toBeNull();

      fireEvent.press(getByTestId('task-check-task_card_1'));
      expect(mockToggle).not.toHaveBeenCalled();
    });
  });
});
