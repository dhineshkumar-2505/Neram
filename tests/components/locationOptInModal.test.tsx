import * as React from 'react';
void React;
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LocationOptInModal } from '../../src/features/location/components/LocationOptInModal';
import { locationPermissionService } from '../../src/features/location/services/locationPermissionService';

jest.mock('../../src/features/location/services/locationPermissionService', () => ({
  locationPermissionService: {
    requestForegroundPermission: jest.fn(),
    openSettings: jest.fn(),
  },
}));

describe('LocationOptInModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConsentGranted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders privacy principles and educational copy when visible', () => {
    const { getByText, getByTestId } = render(
      <LocationOptInModal
        visible={true}
        onClose={mockOnClose}
        onConsentGranted={mockOnConsentGranted}
      />,
    );

    expect(getByText('Share Live Outing Location')).toBeTruthy();
    expect(getByText('Session-Scoped & Temporary')).toBeTruthy();
    expect(getByText('Strict Privacy Boundary')).toBeTruthy();
    expect(getByText('Automatic Ephemeral Purge')).toBeTruthy();
    expect(getByText('Zero Silent Tracking')).toBeTruthy();
    expect(getByText('I Understand & Enable')).toBeTruthy();
    expect(getByText('Not Now')).toBeTruthy();
    expect(getByTestId('consent-continue-button')).toBeTruthy();
    expect(getByTestId('close-opt-in-modal')).toBeTruthy();
  });

  it('calls onClose when close icon or Not Now is tapped', () => {
    const { getByTestId, getByText } = render(
      <LocationOptInModal
        visible={true}
        onClose={mockOnClose}
        onConsentGranted={mockOnConsentGranted}
      />,
    );

    fireEvent.press(getByTestId('close-opt-in-modal'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Not Now'));
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('triggers native OS permission request and fires onConsentGranted when approved', async () => {
    (locationPermissionService.requestForegroundPermission as jest.Mock).mockResolvedValue({
      granted: true,
      state: 'GRANTED',
    });

    const { getByTestId } = render(
      <LocationOptInModal
        visible={true}
        onClose={mockOnClose}
        onConsentGranted={mockOnConsentGranted}
      />,
    );

    fireEvent.press(getByTestId('consent-continue-button'));

    await waitFor(() => {
      expect(locationPermissionService.requestForegroundPermission).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConsentGranted).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error banner when user denies the OS permission dialog', async () => {
    (locationPermissionService.requestForegroundPermission as jest.Mock).mockResolvedValue({
      granted: false,
      state: 'DENIED',
    });

    const { getByTestId, findByText } = render(
      <LocationOptInModal
        visible={true}
        onClose={mockOnClose}
        onConsentGranted={mockOnConsentGranted}
      />,
    );

    fireEvent.press(getByTestId('consent-continue-button'));

    expect(
      await findByText('Location permission was denied. You can retry whenever you are ready.'),
    ).toBeTruthy();
    expect(mockOnConsentGranted).not.toHaveBeenCalled();
  });

  it('shows blocked state with Open App Settings button when permanently blocked', async () => {
    (locationPermissionService.requestForegroundPermission as jest.Mock).mockResolvedValue({
      granted: false,
      state: 'BLOCKED',
    });

    const { getByTestId, findByText } = render(
      <LocationOptInModal
        visible={true}
        onClose={mockOnClose}
        onConsentGranted={mockOnConsentGranted}
      />,
    );

    fireEvent.press(getByTestId('consent-continue-button'));

    expect(await findByText('Permission Blocked')).toBeTruthy();
    const openSettingsBtn = await waitFor(() => getByTestId('open-settings-button'));
    expect(openSettingsBtn).toBeTruthy();

    fireEvent.press(openSettingsBtn);

    await waitFor(() => {
      expect(locationPermissionService.openSettings).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
