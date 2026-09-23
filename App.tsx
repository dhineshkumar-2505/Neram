import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation';
import { AuthProvider } from './src/contexts/AuthContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { OfflineBanner } from './src/components';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NetworkProvider>
        <AuthProvider>
          <RootNavigator />
          <OfflineBanner />
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
