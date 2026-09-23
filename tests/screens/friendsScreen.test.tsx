import * as React from 'react';
void React;
import { render, fireEvent, act } from '@testing-library/react-native';
import { FriendsScreen } from '../../src/features/friends/screens/FriendsScreen';
import * as friendsHook from '../../src/features/friends/hooks/useFriends';
import * as authHook from '../../src/hooks/useAuth';

jest.mock('../../src/features/friends/hooks/useFriends');
jest.mock('../../src/hooks/useAuth');

jest.mock('../../src/features/auth/components/TimeGlyph', () => {
  return () => null;
});

describe('FriendsScreen Component', () => {
  const mockRefresh = jest.fn();
  const mockAcceptRequest = jest.fn();
  const mockDeclineRequest = jest.fn();
  const mockCancelRequest = jest.fn();
  const mockUnfriend = jest.fn();
  const mockBlock = jest.fn();
  const mockUnblock = jest.fn();
  const mockSendRequest = jest.fn();

  const mockFriends = [
    {
      userId: 'friend_1',
      username: 'mayalin',
      displayName: 'Maya Lin',
      avatarPath: null,
      bio: 'Architect',
      friendshipId: 'f_1',
      friendsSince: '2026-09-22T00:00:00Z',
    },
  ];

  const mockIncoming = [
    {
      id: 'req_1',
      senderId: 'user_bob',
      receiverId: 'user_me',
      status: 'PENDING' as const,
      createdAt: '2026-09-22T00:00:00Z',
      respondedAt: null,
      profile: {
        userId: 'user_bob',
        username: 'bobross',
        displayName: 'Bob Ross',
        avatarPath: null,
        bio: 'Painter',
      },
    },
  ];

  const mockOutgoing = [
    {
      id: 'req_2',
      senderId: 'user_me',
      receiverId: 'user_alice',
      status: 'PENDING' as const,
      createdAt: '2026-09-22T00:00:00Z',
      respondedAt: null,
      profile: {
        userId: 'user_alice',
        username: 'aliceinwonderland',
        displayName: 'Alice Liddell',
        avatarPath: null,
        bio: null,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user_me' },
    });

    (friendsHook.useFriends as jest.Mock).mockReturnValue({
      friends: mockFriends,
      incomingRequests: mockIncoming,
      outgoingRequests: mockOutgoing,
      blockedUsers: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      acceptRequest: mockAcceptRequest,
      declineRequest: mockDeclineRequest,
      cancelRequest: mockCancelRequest,
      unfriend: mockUnfriend,
      block: mockBlock,
      unblock: mockUnblock,
      sendRequest: mockSendRequest,
    });
  });

  it('renders header, segmented tabs, and friends list', () => {
    const { getByText, getByRole } = render(<FriendsScreen />);

    expect(getByText('Friends & Circle')).toBeTruthy();
    expect(getByRole('tab', { name: 'Friends (1)' })).toBeTruthy();
    expect(getByRole('tab', { name: /Requests/ })).toBeTruthy();
    expect(getByRole('tab', { name: 'Add Friend' })).toBeTruthy();

    expect(getByText('Maya Lin')).toBeTruthy();
    expect(getByText('@mayalin')).toBeTruthy();
  });

  it('switches to Requests tab and shows incoming and outgoing requests', () => {
    const { getByRole, getByText } = render(<FriendsScreen />);

    const requestsTab = getByRole('tab', { name: /Requests/ });
    fireEvent.press(requestsTab);

    expect(getByText('Incoming Requests (1)')).toBeTruthy();
    expect(getByText('Bob Ross')).toBeTruthy();
    expect(getByText('@bobross')).toBeTruthy();
    expect(getByRole('button', { name: 'Accept friend request from Bob Ross' })).toBeTruthy();
    expect(getByRole('button', { name: 'Decline friend request from Bob Ross' })).toBeTruthy();

    expect(getByText('Sent Requests (1)')).toBeTruthy();
    expect(getByText('Alice Liddell')).toBeTruthy();
    expect(getByRole('button', { name: 'Cancel friend request to Alice Liddell' })).toBeTruthy();
  });

  it('calls acceptRequest when Accept button is pressed in Requests tab', async () => {
    mockAcceptRequest.mockResolvedValueOnce({ success: true });
    const { getByRole } = render(<FriendsScreen />);

    fireEvent.press(getByRole('tab', { name: /Requests/ }));

    const acceptBtn = getByRole('button', { name: 'Accept friend request from Bob Ross' });
    await act(async () => {
      fireEvent.press(acceptBtn);
    });

    expect(mockAcceptRequest).toHaveBeenCalledWith('req_1');
  });

  it('switches to Add Friend tab and displays search input', () => {
    const { getByRole, getByLabelText } = render(<FriendsScreen />);

    fireEvent.press(getByRole('tab', { name: 'Add Friend' }));

    expect(getByLabelText('Search Exact Handle')).toBeTruthy();
  });

  it('shows empty state when friends list is empty', () => {
    (friendsHook.useFriends as jest.Mock).mockReturnValue({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      blockedUsers: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      acceptRequest: mockAcceptRequest,
      declineRequest: mockDeclineRequest,
      cancelRequest: mockCancelRequest,
      unfriend: mockUnfriend,
      block: mockBlock,
      unblock: mockUnblock,
      sendRequest: mockSendRequest,
    });

    const { getByText, getByRole } = render(<FriendsScreen />);

    expect(getByText('No mutual connections yet')).toBeTruthy();
    expect(getByRole('button', { name: 'Add Your First Friend' })).toBeTruthy();
  });
});
