import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { tokens } from '../design';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from './types';

import MainTabNavigator from './MainTabNavigator';
import GroupDetailScreen from './screens/GroupDetailScreen';
import ChatScreen from '../features/chat/screens/ChatScreen';
import TaskBoardScreen from '../features/tasks/screens/TaskBoardScreen';
import { PollsScreen } from '../features/polls/screens/PollsScreen';
import { EventsScreen } from '../features/events/screens/EventsScreen';
import { MediaVaultScreen } from '../features/files/screens/MediaVaultScreen';
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
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="TaskBoard"
            component={TaskBoardScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Polls"
            component={PollsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Events"
            component={EventsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="MediaVault"
            component={MediaVaultScreen}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator
          key={status}
          initialRouteName={status === 'NEEDS_ONBOARDING' ? 'Onboarding' : 'Login'}
        />
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
