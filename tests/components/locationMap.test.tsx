import { fireEvent, render } from '@testing-library/react-native';
import { LocationMap } from '../../src/features/location/components/LocationMap';
import type {
  EventDestination,
  MemberLocationRecord,
} from '../../src/features/location/types';

describe('LocationMap component', () => {
  const currentUserId = 'user_self';

  const mockLocations: MemberLocationRecord[] = [
    {
      sessionId: 'sess_1',
      userId: 'user_self',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      speed: 1.2,
      heading: 90,
      recordedAt: new Date().toISOString(),
      movementState: 'WALKING',
      isStale: false,
      isCurrentUser: true,
      user: {
        userId: 'user_self',
        displayName: 'Self User',
        username: 'self',
        avatarPath: null,
      },
    },
    {
      sessionId: 'sess_1',
      userId: 'user_peer',
      latitude: 12.9816,
      longitude: 77.6046,
      accuracy: 15,
      speed: 11.5,
      heading: 180,
      recordedAt: new Date().toISOString(),
      movementState: 'DRIVING',
      isStale: false,
      isCurrentUser: false,
      user: {
        userId: 'user_peer',
        displayName: 'Peer Member',
        username: 'peermember',
        avatarPath: null,
      },
    },
  ];

  const mockDestination: EventDestination = {
    id: 'dest_1',
    title: 'Hackathon Venue',
    locationName: 'Tech Park Campus',
    latitude: 12.99,
    longitude: 77.62,
    isMilestone: true,
    targetTime: '2026-09-23T18:00:00Z',
    source: 'EVENT_MILESTONE',
  };

  it('renders vector map, camera, member markers, and destination marker', () => {
    const { getByTestId, getByText } = render(
      <LocationMap
        locations={mockLocations}
        destination={mockDestination}
        currentUserId={currentUserId}
        isConnected={true}
      />,
    );

    expect(getByTestId('vector-map-view')).toBeTruthy();
    expect(getByTestId('maplibre-camera')).toBeTruthy();
    expect(getByTestId('member-marker-user_self')).toBeTruthy();
    expect(getByTestId('member-marker-user_peer')).toBeTruthy();
    expect(getByTestId('destination-marker-dest_1')).toBeTruthy();
    expect(getByText('LIVE')).toBeTruthy();
    expect(getByText('2 members')).toBeTruthy();
  });

  it('opens member detail card when a member marker is tapped and closes on close button', () => {
    const { getByTestId, queryByTestId, getByText, getAllByText } = render(
      <LocationMap
        locations={mockLocations}
        destination={mockDestination}
        currentUserId={currentUserId}
        isConnected={true}
      />,
    );

    // Initial state: detail card is closed
    expect(queryByTestId('member-detail-card')).toBeNull();

    // Tap peer member marker
    fireEvent.press(getByTestId('member-marker-user_peer'));

    // Detail card should open
    expect(getByTestId('member-detail-card')).toBeTruthy();
    expect(getByText('Peer Member')).toBeTruthy();
    expect(getByText('DRIVING')).toBeTruthy();
    expect(getAllByText('41 km/h').length).toBe(2); // One in marker pill, one in detail card

    // Close the detail card
    fireEvent.press(getByTestId('close-member-card'));
    expect(queryByTestId('member-detail-card')).toBeNull();
  });

  it('supports "Center on Me" and "Fit Group" controls', () => {
    const { getByTestId } = render(
      <LocationMap
        locations={mockLocations}
        destination={mockDestination}
        currentUserId={currentUserId}
        isConnected={true}
      />,
    );

    // Tap Center on Me
    fireEvent.press(getByTestId('btn-center-me'));

    // Tap Fit Group
    fireEvent.press(getByTestId('btn-fit-group'));
  });
});
