import { fireEvent, render } from '@testing-library/react-native';
import { MemberLocationMarker } from '../../src/features/location/components/MemberLocationMarker';
import type { MemberLocationRecord } from '../../src/features/location/types';

describe('MemberLocationMarker component', () => {
  const baseRecord: MemberLocationRecord = {
    sessionId: 'sess_1',
    userId: 'user_1',
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 10,
    speed: 1.5,
    heading: 45,
    recordedAt: new Date().toISOString(),
    movementState: 'WALKING',
    isStale: false,
    isCurrentUser: false,
    user: {
      userId: 'user_1',
      displayName: 'Dhinesh Kumar',
      username: 'dhinesh',
      avatarPath: null,
    },
  };

  it('renders member marker with initials when no avatar is provided', () => {
    const { getByText, getByTestId } = render(
      <MemberLocationMarker record={baseRecord} />,
    );

    expect(getByTestId('member-marker-user_1')).toBeTruthy();
    expect(getByText('DK')).toBeTruthy(); // Initials for Dhinesh Kumar
    expect(getByText('WALK')).toBeTruthy();
  });

  it('renders member marker with avatar image when avatarPath is present', () => {
    const recordWithAvatar: MemberLocationRecord = {
      ...baseRecord,
      user: {
        userId: 'user_1',
        displayName: 'Avatar User',
        username: 'avatar',
        avatarPath: 'https://example.com/avatar.jpg',
      },
    };

    const { getByTestId, queryByText } = render(
      <MemberLocationMarker record={recordWithAvatar} />,
    );

    expect(getByTestId('member-marker-user_1')).toBeTruthy();
    expect(queryByText('AU')).toBeNull();
  });

  it('displays "YOU" badge and self pulse ring when isCurrentUser is true', () => {
    const selfRecord: MemberLocationRecord = {
      ...baseRecord,
      isCurrentUser: true,
    };

    const { getByTestId, getByText } = render(
      <MemberLocationMarker record={selfRecord} />,
    );

    expect(getByTestId('self-pulse-ring')).toBeTruthy();
    expect(getByTestId('you-badge')).toBeTruthy();
    expect(getByText('YOU')).toBeTruthy();
  });

  it('displays formatted speed for driving state', () => {
    const drivingRecord: MemberLocationRecord = {
      ...baseRecord,
      movementState: 'DRIVING',
      speed: 15.0, // 54 km/h
    };

    const { getByText } = render(
      <MemberLocationMarker record={drivingRecord} />,
    );

    expect(getByText('54 km/h')).toBeTruthy();
  });

  it('displays "STALE" label when isStale is true', () => {
    const staleRecord: MemberLocationRecord = {
      ...baseRecord,
      isStale: true,
    };

    const { getByText } = render(
      <MemberLocationMarker record={staleRecord} />,
    );

    expect(getByText('STALE')).toBeTruthy();
  });

  it('triggers onPress callback when tapped', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <MemberLocationMarker record={baseRecord} onPress={onPressMock} />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPressMock).toHaveBeenCalledWith(baseRecord);
  });
});
