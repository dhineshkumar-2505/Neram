import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { tokens } from '../design';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from './types';

import MainTabNavigator from './MainTabNavigator';
import GroupDetailScreen from './screens/GroupDetailScreen';
import AuthNavigator from './AuthNavigator';
import AuthLoadingScreen from '../features/auth/screens/AuthLoadingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { status } = useAuth();

  // Branded splash while hydrating session from SecureStore
  if (status === 'INITIALIZING') {
    return <AuthLoadingScreen />;
  }

  return (
    <NavigationContainer>
      {status === 'AUTHENTICATED' ? (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="GroupDetail"
            component={GroupDetailScreen}
            options={{
              headerShown: true,
              headerTitle: '',
              headerTintColor: tokens.colors.text.primary,
              headerStyle: { backgroundColor: tokens.colors.surface },
              headerShadowVisible: false,
            }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator
          initialRouteName={status === 'NEEDS_ONBOARDING' ? 'Onboarding' : 'Login'}
        />
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
