import React from 'react';
void React;
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { NetworkContext, type NetworkContextValue } from '../../src/contexts/NetworkContext';

describe('OfflineBanner Component', () => {
  const renderWithNetwork = (value: Partial<NetworkContextValue>) => {
    const fullValue: NetworkContextValue = {
      isConnected: true,
      isInternetReachable: true,
      isRealtimeConnected: true,
      isOffline: false,
      isRestored: false,
      ...value,
    };

    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <NetworkContext.Provider value={fullValue}>
          <OfflineBanner />
        </NetworkContext.Provider>
      </SafeAreaProvider>,
    );
  };

  it('renders nothing when network is fully connected', () => {
    const { queryByTestId } = renderWithNetwork({
      isConnected: true,
      isOffline: false,
      isRestored: false,
    });

    expect(queryByTestId('offline-banner')).toBeNull();
  });

  it('renders offline warning pill when offline', () => {
    const { getByTestId, getByText } = renderWithNetwork({
      isConnected: false,
      isOffline: true,
      isRestored: false,
    });

    expect(getByTestId('offline-banner')).toBeTruthy();
    expect(getByText('No Internet Connection • Realtime paused')).toBeTruthy();
  });

  it('renders connection restored pill when network transitions back', () => {
    const { getByTestId, getByText } = renderWithNetwork({
      isConnected: true,
      isOffline: false,
      isRestored: true,
    });

    expect(getByTestId('offline-banner')).toBeTruthy();
    expect(getByText('Connection Restored')).toBeTruthy();
  });
});
