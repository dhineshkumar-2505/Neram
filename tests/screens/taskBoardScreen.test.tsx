import * as React from 'react';
void React;
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TaskBoardScreen } from '../../src/features/tasks/screens/TaskBoardScreen';
import * as authHook from '../../src/hooks/useAuth';
import * as tasksHook from '../../src/features/tasks/hooks/useTasks';
import * as lifecycleHook from '../../src/features/groups/hooks/useGroupLifecycle';
import { groupService } from '../../src/features/groups/services/groupService';
import type { TaskRecord } from '../../src/features/tasks/types';
import type { RootStackScreenProps } from '../../src/navigation/types';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/tasks/hooks/useTasks');
jest.mock('../../src/features/groups/hooks/useGroupLifecycle');
jest.mock('../../src/features/groups/services/groupService');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('TaskBoardScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
  } as unknown as RootStackScreenProps<'TaskBoard'>['navigation'];

  const mockRoute = {
    key: 'TaskBoard-key',
    name: 'TaskBoard' as const,
    params: {
      groupId: 'grp_test_123',
      groupName: 'Autonomous Robotics Sprint',
    },
  } as unknown as RootStackScreenProps<'TaskBoard'>['route'];

  const mockSampleTask: TaskRecord = {
    id: 'task_sprint_1',
    groupId: 'grp_test_123',
    creatorId: 'user_1',
    title: 'Assemble motor controller',
    description: 'Solder pin headers',
    status: 'NOT_STARTED',
    priority: 'HIGH',
    deadline: null,
    position: 0,
    createdAt: '2026-09-23T10:00:00Z',
    updatedAt: '2026-09-23T10:00:00Z',
    assignees: [],
  };

  const mockRefresh = jest.fn();
  const mockCreateTask = jest.fn();
  const mockToggleStatus = jest.fn();
  const mockDeleteTask = jest.fn();
  const mockSetFilterTab = jest.fn();
  const mockSetSelectedAssigneeId = jest.fn();
  const mockSetSortBy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user_1' },
    });
    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: {
        id: 'grp_test_123',
        name: 'Autonomous Robotics Sprint',
        lifecycle_state: 'ACTIVE',
      },
    });
    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      isExpired: false,
      remainingTime: { formattedText: '4h 30m', totalSeconds: 16200 },
      lifecycleState: 'ACTIVE',
    });
  });

  it('renders LoadingState when isLoading is true', async () => {
    (tasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [],
      allTasks: [],
      counts: { total: 0, active: 0, completed: 0 },
      eligibleAssignees: [],
      filterTab: 'ALL',
      setFilterTab: mockSetFilterTab,
      selectedAssigneeId: null,
      setSelectedAssigneeId: mockSetSelectedAssigneeId,
      sortBy: 'POSITION',
      setSortBy: mockSetSortBy,
      isLoading: true,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      createTask: mockCreateTask,
      toggleTaskStatus: mockToggleStatus,
      deleteTask: mockDeleteTask,
      isReadOnly: false,
    });

    const { getByText } = render(
      <TaskBoardScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText('Connecting to secure task board...')).toBeTruthy();
    });
  });

  it('renders ErrorState with retry when error is present', async () => {
    (tasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [],
      allTasks: [],
      counts: { total: 0, active: 0, completed: 0 },
      eligibleAssignees: [],
      filterTab: 'ALL',
      setFilterTab: mockSetFilterTab,
      selectedAssigneeId: null,
      setSelectedAssigneeId: mockSetSelectedAssigneeId,
      sortBy: 'POSITION',
      setSortBy: mockSetSortBy,
      isLoading: false,
      isRefreshing: false,
      error: 'Failed to synchronize tasks with server.',
      refresh: mockRefresh,
      createTask: mockCreateTask,
      toggleTaskStatus: mockToggleStatus,
      deleteTask: mockDeleteTask,
      isReadOnly: false,
    });

    const { getByText } = render(
      <TaskBoardScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText('Failed to synchronize tasks with server.')).toBeTruthy();
    });
    fireEvent.press(getByText('Try Again'));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('renders EmptyState when task list is empty', async () => {
    (tasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [],
      allTasks: [],
      counts: { total: 0, active: 0, completed: 0 },
      eligibleAssignees: [],
      filterTab: 'ALL',
      setFilterTab: mockSetFilterTab,
      selectedAssigneeId: null,
      setSelectedAssigneeId: mockSetSelectedAssigneeId,
      sortBy: 'POSITION',
      setSortBy: mockSetSortBy,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      createTask: mockCreateTask,
      toggleTaskStatus: mockToggleStatus,
      deleteTask: mockDeleteTask,
      isReadOnly: false,
    });

    const { getByText } = render(
      <TaskBoardScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText('No Tasks Yet')).toBeTruthy();
    });
  });

  it('renders tasks, segment tabs, and opens create modal when FAB is pressed', async () => {
    (tasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [mockSampleTask],
      allTasks: [mockSampleTask],
      counts: { total: 1, active: 1, completed: 0 },
      eligibleAssignees: [],
      filterTab: 'ALL',
      setFilterTab: mockSetFilterTab,
      selectedAssigneeId: null,
      setSelectedAssigneeId: mockSetSelectedAssigneeId,
      sortBy: 'POSITION',
      setSortBy: mockSetSortBy,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      createTask: mockCreateTask,
      toggleTaskStatus: mockToggleStatus,
      deleteTask: mockDeleteTask,
      isReadOnly: false,
    });

    const { getByText, getByTestId } = render(
      <TaskBoardScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText('Autonomous Robotics Sprint')).toBeTruthy();
      expect(getByText('Assemble motor controller')).toBeTruthy();
    });

    expect(getByText('All (1)')).toBeTruthy();
    expect(getByText('Active (1)')).toBeTruthy();
    expect(getByText('Done (0)')).toBeTruthy();

    // Switch tab
    fireEvent.press(getByTestId('filter-tab-COMPLETED'));
    expect(mockSetFilterTab).toHaveBeenCalledWith('COMPLETED');

    // Press FAB to open create modal
    fireEvent.press(getByTestId('add-task-fab'));
    expect(getByTestId('create-task-modal')).toBeTruthy();
  });

  it('renders read-only freeze banner and hides FAB when group is expired', async () => {
    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      isExpired: true,
      remainingTime: { formattedText: 'EXPIRED', totalSeconds: 0 },
      lifecycleState: 'EXPIRED',
    });

    (tasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [mockSampleTask],
      allTasks: [mockSampleTask],
      counts: { total: 1, active: 1, completed: 0 },
      eligibleAssignees: [],
      filterTab: 'ALL',
      setFilterTab: mockSetFilterTab,
      selectedAssigneeId: null,
      setSelectedAssigneeId: mockSetSelectedAssigneeId,
      sortBy: 'POSITION',
      setSortBy: mockSetSortBy,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      createTask: mockCreateTask,
      toggleTaskStatus: mockToggleStatus,
      deleteTask: mockDeleteTask,
      isReadOnly: true,
    });

    const { getByTestId, queryByTestId } = render(
      <TaskBoardScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByTestId('task-board-readonly-banner')).toBeTruthy();
    });
    expect(queryByTestId('add-task-fab')).toBeNull();
  });
});
