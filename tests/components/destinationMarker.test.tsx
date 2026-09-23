import { fireEvent, render } from '@testing-library/react-native';
import { DestinationMarker } from '../../src/features/location/components/DestinationMarker';
import type { EventDestination } from '../../src/features/location/types';

describe('DestinationMarker component', () => {
  const milestoneDestination: EventDestination = {
    id: 'dest_milestone',
    title: 'Final Pitch Presentation',
    locationName: 'Auditorium Hall B',
    latitude: 12.9716,
    longitude: 77.5946,
    isMilestone: true,
    targetTime: '2026-09-23T15:00:00Z',
    source: 'EVENT_MILESTONE',
  };

  const standardDestination: EventDestination = {
    id: 'dest_std',
    title: 'Cafe Meeting',
    locationName: 'Third Wave Coffee',
    latitude: 12.9352,
    longitude: 77.6245,
    isMilestone: false,
    targetTime: '2026-09-23T11:00:00Z',
    source: 'EVENT',
  };

  it('renders milestone marker with MILESTONE tag and venue name', () => {
    const { getByText, getByTestId } = render(
      <DestinationMarker destination={milestoneDestination} />,
    );

    expect(getByTestId('destination-marker-dest_milestone')).toBeTruthy();
    expect(getByText('MILESTONE')).toBeTruthy();
    expect(getByText('Auditorium Hall B')).toBeTruthy();
  });

  it('renders standard destination without milestone tag', () => {
    const { getByText, queryByText, getByTestId } = render(
      <DestinationMarker destination={standardDestination} />,
    );

    expect(getByTestId('destination-marker-dest_std')).toBeTruthy();
    expect(queryByText('MILESTONE')).toBeNull();
    expect(getByText('Third Wave Coffee')).toBeTruthy();
  });

  it('triggers onPress callback when tapped', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <DestinationMarker
        destination={milestoneDestination}
        onPress={onPressMock}
      />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPressMock).toHaveBeenCalledWith(milestoneDestination);
  });
});
