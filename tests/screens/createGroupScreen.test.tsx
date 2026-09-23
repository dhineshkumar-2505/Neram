import * as React from 'react';
void React;
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { CreateGroupScreen } from '../../src/features/groups/screens/CreateGroupScreen';
import { groupService } from '../../src/features/groups/services/groupService';
import { friendsService } from '../../src/features/friends/services/friendsService';
import * as authHook from '../../src/hooks/useAuth';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/groups/services/groupService');
jest.mock('../../src/features/friends/services/friendsService');

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

describe('CreateGroupScreen Component', () => {
  const mockUser = { id: 'test_creator_id', email: 'creator@neram.app' };

  const mockFriends = [
    {
      userId: 'friend_alpha',
      username: 'alice',
      displayName: 'Alice Walker',
      avatarPath: null,
      bio: null,
      friendshipId: 'fs_1',
      friendsSince: '2026-09-22T00:00:00Z',
    },
    {
      userId: 'friend_beta',
      username: 'bob',
      displayName: 'Bob Dylan',
      avatarPath: null,
      bio: null,
      friendshipId: 'fs_2',
      friendsSince: '2026-09-22T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      profile: { user_id: 'test_creator_id', display_name: 'Creator' },
      status: 'AUTHENTICATED',
    });
    (friendsService.fetchFriends as jest.Mock).mockResolvedValue({
      friends: mockFriends,
    });
  });

  it('renders all sections and disables launch button when name is empty', async () => {
    const screen = render(<CreateGroupScreen />);
    await screen.findByText('Alice Walker');

    expect(screen.getByText('Create Temporary Space')).toBeTruthy();
    expect(screen.getByText('SPACE IDENTITY')).toBeTruthy();
    expect(screen.getByText('PURPOSE & LAYOUT ARCHETYPE')).toBeTruthy();
    expect(screen.getByText('LIFESPAN CONFIGURATION')).toBeTruthy();
    expect(screen.getByText('INVITE MUTUAL FRIENDS')).toBeTruthy();

    const nameInput = screen.getByPlaceholderText('e.g. Weekend Hike, Hackathon Team Alpha...');
    expect(nameInput).toBeTruthy();

    const launchButton = screen.getByRole('button', { name: /Launch Temporary Space/i });
    expect(launchButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables launch button when valid space name is entered', async () => {
    const screen = render(<CreateGroupScreen />);
    await screen.findByText('Alice Walker');

    const nameInput = screen.getByPlaceholderText('e.g. Weekend Hike, Hackathon Team Alpha...');
    fireEvent.changeText(nameInput, 'Weekend Roadtrip');

    const launchButton = screen.getByRole('button', { name: /Launch Temporary Space/i });
    expect(launchButton.props.accessibilityState?.disabled).toBe(false);
  });

  it('switches purpose archetype when tapped', async () => {
    const screen = render(<CreateGroupScreen />);
    await screen.findByText('Alice Walker');

    const hackathonRadio = screen.getByRole('radio', { name: /Hackathon Archetype/i });
    expect(hackathonRadio).toBeTruthy();

    fireEvent.press(hackathonRadio);
    expect(hackathonRadio.props.accessibilityState?.selected).toBe(true);
  });

  it('renders mutual friends and toggles invitation selection', async () => {
    const { findByText, getByRole } = render(<CreateGroupScreen />);

    // Wait for friends to load
    const friendAlice = await findByText('Alice Walker');
    expect(friendAlice).toBeTruthy();

    const aliceCheckbox = getByRole('checkbox', { name: /Alice Walker \(@alice\)/i });
    expect(aliceCheckbox.props.accessibilityState?.checked).toBe(false);

    // Toggle invite on
    fireEvent.press(aliceCheckbox);
    expect(aliceCheckbox.props.accessibilityState?.checked).toBe(true);

    // Toggle invite off
    fireEvent.press(aliceCheckbox);
    expect(aliceCheckbox.props.accessibilityState?.checked).toBe(false);
  });

  it('submits group creation and navigates to GroupDetail on success', async () => {
    const mockCreatedGroup = {
      id: 'grp_new_456',
      name: 'Alpha Hackathon',
      purpose: 'HACKATHON',
    };

    (groupService.createGroup as jest.Mock).mockResolvedValueOnce({
      group: mockCreatedGroup,
    });

    const { getByPlaceholderText, getByRole, findByText } = render(<CreateGroupScreen />);

    const nameInput = getByPlaceholderText('e.g. Weekend Hike, Hackathon Team Alpha...');
    fireEvent.changeText(nameInput, 'Alpha Hackathon');

    const descInput = getByPlaceholderText('What are we doing? Where are we meeting?');
    fireEvent.changeText(descInput, 'Building the core temporary group engine');

    // Select Alice
    await findByText('Alice Walker');
    const aliceCheckbox = getByRole('checkbox', { name: /Alice Walker \(@alice\)/i });
    fireEvent.press(aliceCheckbox);

    // Press Launch
    const launchButton = getByRole('button', { name: /Launch Temporary Space/i });
    await act(async () => {
      fireEvent.press(launchButton);
    });

    expect(groupService.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alpha Hackathon',
        description: 'Building the core temporary group engine',
        initialMemberIds: ['friend_alpha'],
      }),
      'test_creator_id',
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('GroupDetail', {
        groupId: 'grp_new_456',
        groupName: 'Alpha Hackathon',
      });
    });
  });

  it('displays error banner if group creation fails', async () => {
    (groupService.createGroup as jest.Mock).mockResolvedValueOnce({
      group: null,
      error: 'Security violation: Cannot add members to an expired or inactive group.',
    });

    const { getByPlaceholderText, getByRole, findByText } = render(<CreateGroupScreen />);
    await findByText('Alice Walker');

    const nameInput = getByPlaceholderText('e.g. Weekend Hike, Hackathon Team Alpha...');
    fireEvent.changeText(nameInput, 'Failed Space');

    const launchButton = getByRole('button', { name: /Launch Temporary Space/i });
    await act(async () => {
      fireEvent.press(launchButton);
    });

    const errorAlert = await findByText(/Security violation: Cannot add members/i);
    expect(errorAlert).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
