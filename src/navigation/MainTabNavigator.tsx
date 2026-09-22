import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { tokens } from '../design';
import type { MainTabParamList } from './types';

import HomeScreen from './screens/HomeScreen';
import FriendsScreen from './screens/FriendsScreen';
import CreateScreen from './screens/CreateScreen';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary.default,
        tabBarInactiveTintColor: tokens.colors.text.secondary,
        tabBarStyle: {
          backgroundColor: tokens.colors.surface,
          borderTopColor: tokens.colors.border.subtle,
          height: tokens.layout.bottomNavHeight,
          paddingBottom: tokens.spacing.sm,
          paddingTop: tokens.spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: tokens.typography.sizes.caption,
          fontWeight: tokens.typography.weights.medium,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home Command Center Tab',
        }}
      />
      <Tab.Screen
        name="FriendsTab"
        component={FriendsScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarAccessibilityLabel: 'Friends Management Tab',
        }}
      />
      <Tab.Screen
        name="CreateTab"
        component={CreateScreen}
        options={{
          tabBarLabel: 'Create',
          tabBarAccessibilityLabel: 'Create Temporary Group Tab',
        }}
      />
      <Tab.Screen
        name="ActivityTab"
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarAccessibilityLabel: 'Activity and Notifications Tab',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'User Profile and Settings Tab',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
