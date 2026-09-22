import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { tokens } from '../design';
import type { RootStackParamList } from './types';

import MainTabNavigator from './MainTabNavigator';
import GroupDetailScreen from './screens/GroupDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
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
    </NavigationContainer>
  );
};

export default RootNavigator;
